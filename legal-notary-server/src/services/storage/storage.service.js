/**
 * src/services/storage/storage.service.js — Abstraction unifiée de stockage documentaire.
 *
 * Supporte 3 modes d'infrastructure sans modifier le code métier :
 *   - MODE A (LocalStorage) : Serveur physique local de l'étude (NAS / disque local).
 *   - MODE B (CloudStorage)  : Stockage Cloud sécurisé (S3 / Cloud Storage / Object Storage).
 *   - MODE C (HybridStorage) : Stockage local immédiat + réplication asynchrone vers le Cloud.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pool } = require("../../db/pool");

class BaseStorageAdapter {
  async enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType) {
    throw new Error("enregistrerFichier non implémenté");
  }
  async lireFichier(cheminStockage) {
    throw new Error("lireFichier non implémenté");
  }
  async supprimerFichier(cheminStockage) {
    throw new Error("supprimerFichier non implémenté");
  }
}

class LocalStorageAdapter extends BaseStorageAdapter {
  constructor(baseDir) {
    super();
    this.baseDir = baseDir || path.join(__dirname, "../../../uploads/documents");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType) {
    const etudeDir = path.join(this.baseDir, String(etudeId), String(dossierId));
    if (!fs.existsSync(etudeDir)) {
      fs.mkdirSync(etudeDir, { recursive: true });
    }
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const safeName = `${Date.now()}_${nomFichier.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const targetPath = path.join(etudeDir, safeName);
    fs.writeFileSync(targetPath, buffer);

    return {
      cheminStockage: `local://${etudeId}/${dossierId}/${safeName}`,
      hashSha256: hash,
      tailleOctets: buffer.length,
      mimeType: mimeType || "application/pdf",
    };
  }

  async lireFichier(cheminStockage) {
    const rel = cheminStockage.replace("local://", "");
    const fullPath = path.join(this.baseDir, rel);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }

  async supprimerFichier(cheminStockage) {
    const rel = cheminStockage.replace("local://", "");
    const fullPath = path.join(this.baseDir, rel);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    return true;
  }
}

class CloudStorageAdapter extends BaseStorageAdapter {
  async enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType) {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const safeName = `${Date.now()}_${nomFichier.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    // Simulation d'upload vers bucket chiffré cloud
    return {
      cheminStockage: `cloud://notary-vault-ci/${etudeId}/${dossierId}/${safeName}`,
      hashSha256: hash,
      tailleOctets: buffer.length,
      mimeType: mimeType || "application/pdf",
    };
  }

  async lireFichier(cheminStockage) {
    return Buffer.from(`[Cloud Document Stream: ${cheminStockage}]`);
  }

  async supprimerFichier(cheminStockage) {
    return true;
  }
}

class HybridStorageAdapter extends BaseStorageAdapter {
  constructor(localAdapter, cloudAdapter) {
    super();
    this.local = localAdapter;
    this.cloud = cloudAdapter;
  }

  async enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType) {
    // 1. Sauvegarde locale immédiate (zéro dépendance Internet)
    const localRes = await this.local.enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType);
    return {
      ...localRes,
      mode: "hybride_local_et_queue_cloud",
    };
  }

  async lireFichier(cheminStockage) {
    if (cheminStockage.startsWith("local://")) {
      return this.local.lireFichier(cheminStockage);
    }
    return this.cloud.lireFichier(cheminStockage);
  }

  async supprimerFichier(cheminStockage) {
    return this.local.supprimerFichier(cheminStockage);
  }
}

// Fabrique d'adaptateur
const localAdapter = new LocalStorageAdapter();
const cloudAdapter = new CloudStorageAdapter();
const hybridAdapter = new HybridStorageAdapter(localAdapter, cloudAdapter);

function obtenirAdaptateur(mode = "hybride") {
  if (mode === "local") return localAdapter;
  if (mode === "cloud") return cloudAdapter;
  return hybridAdapter;
}

/**
 * Service Métier Documentaire
 */
class StorageService {
  static async enregistrerDocument({
    etudeId = "a0000000-0000-0000-0000-000000000001",
    dossierId,
    typeDocument = "05_actes_minute",
    nomFichier,
    buffer,
    mimeType = "application/pdf",
    statutOcr = "traite",
    texteOcr = "",
    statutValidation = "valide",
    creeParId = null,
    metadata = {},
  }) {
    const adaptateur = obtenirAdaptateur("hybride");
    const stock = await adaptateur.enregistrerFichier(etudeId, dossierId, nomFichier, buffer, mimeType);

    const { rows } = await pool.query(
      `INSERT INTO documents_numeriques
       (etude_id, dossier_id, type_document, nom_fichier, chemin_stockage, taille_octets, mime_type, hash_sha256, statut_ocr, texte_ocr, statut_validation, cree_par_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        etudeId,
        dossierId,
        typeDocument,
        nomFichier,
        stock.cheminStockage,
        stock.tailleOctets,
        stock.mimeType,
        stock.hashSha256,
        statutOcr,
        texteOcr,
        statutValidation,
        creeParId,
        JSON.stringify(metadata),
      ]
    );

    // Mettre en file de synchronisation hybride
    await pool.query(
      `INSERT INTO file_synchronisation (etude_id, entite_type, entite_id, action, charge_utile, hash_integrite)
       VALUES ($1, 'document_numerique', $2, 'create', $3, $4)`,
      [etudeId, rows[0].id, JSON.stringify(rows[0]), stock.hashSha256]
    );

    return rows[0];
  }

  static async listerDocumentsDossier(dossierId) {
    const { rows } = await pool.query(
      `SELECT d.*, u.nom_complet AS cree_par_nom
       FROM documents_numeriques d
       LEFT JOIN utilisateurs u ON u.id = d.cree_par_id
       WHERE d.dossier_id = $1 AND d.archived_at IS NULL
       ORDER BY d.created_at DESC`,
      [dossierId]
    );
    return rows;
  }
}

module.exports = {
  StorageService,
  LocalStorageAdapter,
  CloudStorageAdapter,
  HybridStorageAdapter,
  obtenirAdaptateur,
};
