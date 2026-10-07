/**
 * src/services/recus.service.js — Gestion des Reçus de Paiement & Quittances Officielles de l'Étude.
 */

const { pool, avecTransaction } = require("../db/pool");
const crypto = require("crypto");
const { lireFichierJson, ecrireFichierJson } = require("./stockage-persistant.service");
const parametresService = require("./parametres.service");
const emailDeploiementService = require("./email-deploiement.service");
const { nombreEnLettresFCFA } = require("./fiscal.service");

function recuVersCamel(l) {
  if (!l) return null;
  return {
    id: l.id,
    etudeId: l.etude_id || l.etudeId,
    numeroRecu: l.numero_recu || l.numeroRecu,
    dossierId: l.dossier_id || l.dossierId,
    numeroDossier: l.numero_dossier || l.numeroDossier,
    typeActeId: l.type_acte_id || l.typeActeId,
    clientNom: l.client_nom || l.clientNom,
    clientEmail: l.client_email || l.clientEmail,
    clientTelephone: l.client_telephone || l.clientTelephone,
    montantTotal: Number(l.montant_total !== undefined ? l.montant_total : l.montantTotal) || 0,
    fraisOuverture: Number(l.frais_ouverture !== undefined ? l.frais_ouverture : l.fraisOuverture) || 0,
    provision: Number(l.provision !== undefined ? l.provision : l.provision) || 0,
    montantAssiette: Number(l.montant_assiette !== undefined ? l.montant_assiette : l.montantAssiette) || 0,
    modePaiement: l.mode_paiement || l.modePaiement || "Espèces",
    statut: l.statut || "en_attente_validation", // 'en_attente_validation' | 'valide' | 'rejete'
    creeParId: l.cree_par_id || l.creeParId,
    valideParId: l.valide_par_id || l.valideParId,
    valideLe: l.valide_le || l.valideLe || null,
    envoyeAuClientLe: l.envoye_au_client_le || l.envoyeAuClientLe || null,
    recuScanneUrl: l.recu_scanne_url || l.recuScanneUrl || null,
    recuScanneNom: l.recu_scanne_nom || l.recuScanneNom || null,
    recuScanneLe: l.recu_scanne_le || l.recuScanneLe || null,
    observations: l.observations || "",
    createdAt: l.created_at || l.createdAt || new Date().toISOString(),
  };
}

const RECUS_MEMOIRE = new Map();

// Charger les reçus persistés au démarrage
(function initRecus() {
  try {
    const recusSauv = lireFichierJson("recus_paiement_persistants.json", []);
    if (Array.isArray(recusSauv)) {
      for (const r of recusSauv) {
        if (r && r.id) RECUS_MEMOIRE.set(r.id, r);
      }
    }
  } catch (_) {}
})();

function persisterRecusSurDisque() {
  try {
    ecrireFichierJson("recus_paiement_persistants.json", Array.from(RECUS_MEMOIRE.values()));
  } catch (_) {}
}

async function prochainNumeroRecu(etudeId) {
  const annee = new Date().getFullYear();
  try {
    let query = "SELECT COUNT(*)::int AS n FROM recus_paiement WHERE EXTRACT(YEAR FROM created_at) = $1";
    const params = [annee];
    if (etudeId) {
      params.push(etudeId);
      query += ` AND etude_id = $${params.length}`;
    }
    const { rows } = await pool.query(query, params);
    if (rows && rows.length) {
      const n = rows[0].n + 1;
      return `RECU-${annee}-${String(n).padStart(4, "0")}`;
    }
  } catch (_) {}

  const nbMem = Array.from(RECUS_MEMOIRE.values()).filter(r => (!etudeId || r.etudeId === etudeId)).length + 1;
  return `RECU-${annee}-${String(nbMem).padStart(4, "0")}`;
}

async function creerRecuPaiement({
  etudeId,
  dossierId,
  numeroDossier,
  typeActeId,
  clientNom,
  clientEmail,
  clientTelephone,
  fraisOuverture,
  provision,
  montantProvision,
  montantAssiette,
  modePaiement,
  observations,
  creeParId,
}) {
  const provisionReelle = Number(provision !== undefined ? provision : montantProvision) || 0;
  const fraisReels = Number(fraisOuverture) || 0;
  const total = fraisReels + provisionReelle;
  const numero = await prochainNumeroRecu(etudeId);
  const eid = etudeId || "a0000000-0000-0000-0000-000000000001";
  const id = "recu-" + crypto.randomUUID().slice(0, 8);

  try {
    const { rows } = await pool.query(
      `INSERT INTO recus_paiement (
         id, etude_id, numero_recu, dossier_id, client_nom, client_email, client_telephone,
         montant_total, frais_ouverture, provision, montant_assiette, mode_paiement,
         statut, cree_par_id, observations, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
       RETURNING *`,
      [
        id, eid, numero, dossierId, clientNom, clientEmail || null, clientTelephone || null,
        total, Number(fraisOuverture) || 0, Number(provision) || 0, Number(montantAssiette) || 0,
        modePaiement || "Espèces", "en_attente_validation", creeParId || null, observations || null,
      ]
    );
    if (rows && rows.length) {
      const recu = recuVersCamel(rows[0]);
      recu.numeroDossier = numeroDossier;
      recu.typeActeId = typeActeId;
      RECUS_MEMOIRE.set(recu.id, recu);
      persisterRecusSurDisque();
      return recu;
    }
  } catch (errDb) {
    console.warn("[Reçus] Fallback mémoire pour création de reçu :", errDb.message);
  }

  const recuLocal = {
    id,
    etudeId: eid,
    numeroRecu: numero,
    dossierId,
    numeroDossier,
    typeActeId,
    clientNom,
    clientEmail: clientEmail || "",
    clientTelephone: clientTelephone || "",
    montantTotal: total,
    fraisOuverture: fraisReels,
    provision: provisionReelle,
    montantAssiette: Number(montantAssiette) || 0,
    modePaiement: modePaiement || "Espèces",
    statut: "en_attente_validation",
    creeParId,
    valideParId: null,
    valideLe: null,
    envoyeAuClientLe: null,
    recuScanneUrl: null,
    recuScanneNom: null,
    recuScanneLe: null,
    observations: observations || "",
    createdAt: new Date().toISOString(),
  };

  RECUS_MEMOIRE.set(id, recuLocal);
  persisterRecusSurDisque();
  return recuLocal;
}

async function listerRecusPourUtilisateur(utilisateur, filtres = {}) {
  const etudeId = utilisateur ? utilisateur.etudeId : null;
  const estCompteDemo = !utilisateur || etudeId === "etude-abidjan-01" || etudeId === "a0000000-0000-0000-0000-000000000001" || (utilisateur.email && utilisateur.email.endsWith("@notaire.ci"));

  try {
    let query = `
      SELECT r.*, d.numero_dossier, d.type_acte_id
      FROM recus_paiement r
      LEFT JOIN dossiers d ON d.id = r.dossier_id
      WHERE 1=1
    `;
    const params = [];
    if (etudeId && !estCompteDemo) {
      params.push(etudeId);
      query += ` AND (r.etude_id = $${params.length} OR r.etude_id IS NULL)`;
    }
    if (filtres.statut) {
      params.push(filtres.statut);
      query += ` AND r.statut = $${params.length}`;
    }
    if (filtres.dossierId) {
      params.push(filtres.dossierId);
      query += ` AND r.dossier_id = $${params.length}`;
    }
    query += " ORDER BY r.created_at DESC";

    const { rows } = await pool.query(query, params);
    if (rows && rows.length) {
      return rows.map(recuVersCamel);
    }
  } catch (_) {}

  // Fallback mémoire
  let liste = Array.from(RECUS_MEMOIRE.values());
  if (etudeId && !estCompteDemo) {
    liste = liste.filter(r => r.etudeId === etudeId);
  }
  if (filtres.statut) {
    liste = liste.filter(r => r.statut === filtres.statut);
  }
  if (filtres.dossierId) {
    liste = liste.filter(r => r.dossierId === filtres.dossierId);
  }
  return liste.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function obtenirRecuParId(id) {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, d.numero_dossier, d.type_acte_id
       FROM recus_paiement r
       LEFT JOIN dossiers d ON d.id = r.dossier_id
       WHERE r.id = $1`,
      [id]
    );
    if (rows && rows.length) return recuVersCamel(rows[0]);
  } catch (_) {}

  return RECUS_MEMOIRE.get(id) || null;
}

async function validerEtEnvoyerRecuClient(recuId, valideurUtilisateur) {
  const recu = await obtenirRecuParId(recuId);
  if (!recu) throw new Error("Reçu de paiement introuvable.");

  const dateValidation = new Date().toISOString();
  let emailEnvoyeResult = null;

  try {
    await pool.query(
      `UPDATE recus_paiement
       SET statut = 'valide', valide_par_id = $1, valide_le = now(), envoye_au_client_le = now()
       WHERE id = $2`,
      [valideurUtilisateur.id, recuId]
    );
  } catch (_) {}

  recu.statut = "valide";
  recu.valideParId = valideurUtilisateur.id;
  recu.valideLe = dateValidation;
  recu.envoyeAuClientLe = dateValidation;
  RECUS_MEMOIRE.set(recuId, recu);
  persisterRecusSurDisque();

  // Envoi email au client si son email est renseigné
  if (recu.clientEmail) {
    const params = await parametresService.obtenir(valideurUtilisateur.etudeId);
    emailEnvoyeResult = await emailDeploiementService.envoyerEmailRecuPaiementClient({
      destinataireEmail: recu.clientEmail,
      clientNom: recu.clientNom,
      numeroRecu: recu.numeroRecu,
      numeroDossier: recu.numeroDossier || "DOS-OFFICIEL",
      typeActe: recu.typeActeId || "Dossier Notarié",
      montantTotal: recu.montantTotal,
      fraisOuverture: recu.fraisOuverture,
      provision: recu.provision,
      modePaiement: recu.modePaiement,
      datePaiement: recu.createdAt,
      nomNotaire: params.nomNotaire,
      nomEtude: params.nomEtude,
      adresseEtude: params.adresse,
      telephoneEtude: params.telephoneFixe || params.telephone,
      emailEtude: params.email,
    });
  }

  return { recu, emailEnvoye: emailEnvoyeResult };
}

async function joindreScanRecu(recuId, { urlScan, nomFichier, utilisateurId }) {
  const recu = await obtenirRecuParId(recuId);
  if (!recu) throw new Error("Reçu de paiement introuvable.");

  const dateScan = new Date().toISOString();

  try {
    await pool.query(
      `UPDATE recus_paiement
       SET recu_scanne_url = $1, recu_scanne_nom = $2, recu_scanne_le = now()
       WHERE id = $3`,
      [urlScan, nomFichier || "Recu_Emarge.pdf", recuId]
    );

    if (recu.dossierId) {
      await pool.query(
        `UPDATE dossier_taches
         SET statut = 'effectuee', updated_at = now()
         WHERE dossier_id = $1 AND libelle LIKE '%Scanner le reçu de paiement%'`,
        [recu.dossierId]
      );
      await pool.query(
        `INSERT INTO dossier_mouvements (dossier_id, utilisateur_id, description)
         VALUES ($1, $2, $3)`,
        [recu.dossierId, utilisateurId || null, `Scan du reçu émargé N° ${recu.numeroRecu} rattaché au dossier.`]
      );
    }
  } catch (_) {}

  recu.recuScanneUrl = urlScan;
  recu.recuScanneNom = nomFichier || "Recu_Emarge.pdf";
  recu.recuScanneLe = dateScan;
  RECUS_MEMOIRE.set(recuId, recu);
  persisterRecusSurDisque();

  return recu;
}

module.exports = {
  creerRecuPaiement,
  listerRecusPourUtilisateur,
  obtenirRecuParId,
  validerEtEnvoyerRecuClient,
  joindreScanRecu,
  prochainNumeroRecu,
  recuVersCamel,
};
