/**
 * src/services/kyc.service.js — Service de gestion des Fiches KYC Notariales
 * Conforme à la Loi n°2024-363 du 11 juin 2024 et l'Ordonnance 895 (LBC/FT/FP)
 * Chambre des Notaires de Côte d'Ivoire
 */

const crypto = require("crypto");
const { pool } = require("../db/pool");

/**
 * Génère ou récupère un token d'accès public sécurisé pour le remplissage KYC du dossier.
 */
async function genererOuRecupererTokenKyc(dossierId, utilisateurId) {
  const dossierRes = await pool.query(
    `SELECT d.id, d.numero_dossier, d.montant_assiette, ta.libelle AS type_acte_libelle,
            COALESCE((SELECT string_agg(c.nom, ', ') FROM dossier_comparants c WHERE c.dossier_id = d.id), '') AS comparants_noms
     FROM dossiers d
     JOIN types_actes ta ON ta.id = d.type_acte_id
     WHERE d.id = $1`,
    [dossierId]
  );

  if (!dossierRes.rows.length) {
    const err = new Error("Dossier introuvable");
    err.status = 404;
    throw err;
  }

  const dossier = dossierRes.rows[0];

  // Vérifier s'il existe déjà une fiche KYC pour ce dossier
  const kycRes = await pool.query(
    "SELECT id, token_acces, statut, type_personne, donnees_kyc, signature_client, signe_le, signe_a FROM dossier_kyc WHERE dossier_id = $1",
    [dossierId]
  );

  let kycRow;
  if (kycRes.rows.length) {
    kycRow = kycRes.rows[0];
  } else {
    const token = crypto.randomBytes(24).toString("hex");
    const insertRes = await pool.query(
      `INSERT INTO dossier_kyc (dossier_id, token_acces, statut, type_personne, cree_par)
       VALUES ($1, $2, 'en_attente', 'physique', $3)
       RETURNING id, token_acces, statut, type_personne, donnees_kyc, signature_client, signe_le, signe_a`,
      [dossierId, token, utilisateurId || null]
    );
    kycRow = insertRes.rows[0];
  }

  return {
    dossierId: dossier.id,
    numeroDossier: dossier.numero_dossier,
    typeActe: dossier.type_acte_libelle,
    comparantsNoms: dossier.comparants_noms,
    token: kycRow.token_acces,
    statut: kycRow.statut,
    typePersonne: kycRow.type_personne,
    donnees: kycRow.donnees_kyc || {},
    signature: kycRow.signature_client,
    signeLe: kycRow.signe_le,
    signeA: kycRow.signe_a,
  };
}

/**
 * Récupère les données publiques pour afficher le formulaire KYC au client ayant scanné le QR Code.
 */
async function obtenirFormulaireKycPublic(token) {
  if (!token || typeof token !== "string") {
    const err = new Error("Token d'accès invalide");
    err.status = 400;
    throw err;
  }

  const kycRes = await pool.query(
    `SELECT k.id, k.dossier_id, k.token_acces, k.statut, k.type_personne, k.donnees_kyc, k.signature_client, k.signe_le, k.signe_a,
            d.numero_dossier, d.montant_assiette, ta.libelle AS type_acte_libelle,
            COALESCE((SELECT string_agg(c.nom, ', ') FROM dossier_comparants c WHERE c.dossier_id = d.id), '') AS comparants_noms
     FROM dossier_kyc k
     JOIN dossiers d ON d.id = k.dossier_id
     JOIN types_actes ta ON ta.id = d.type_acte_id
     WHERE k.token_acces = $1`,
    [token]
  );

  if (!kycRes.rows.length) {
    const err = new Error("Lien KYC expiré ou introuvable");
    err.status = 404;
    throw err;
  }

  const kyc = kycRes.rows[0];

  // Paramètres de l'étude pour l'en-tête officiel
  const parametresService = require("./parametres.service");
  const params = await parametresService.obtenir();

  return {
    token: kyc.token_acces,
    statut: kyc.statut,
    typePersonne: kyc.type_personne,
    dossier: {
      id: kyc.dossier_id,
      numeroDossier: kyc.numero_dossier,
      typeActe: kyc.type_acte_libelle,
      comparantsNoms: kyc.comparants_noms,
      montantAssiette: Number(kyc.montant_assiette) || 0,
    },
    etude: {
      nomEtude: params.nomEtude || "OFFICE NOTARIAL",
      titreNotaire: params.titreNotaire || "Maître",
      nomNotaire: params.nomNotaire || "",
      numeroOffice: params.numeroOrdre || "Office Notarial",
      adresse: params.adresse || "Abidjan, Côte d'Ivoire",
      boitePostale: params.boitePostale || "",
      telephone: params.telephoneFixe || params.telephonePortable || params.telephone || "",
      email: params.email || "",
    },
    donnees: kyc.donnees_kyc || {},
    signature: kyc.signature_client,
    signeLe: kyc.signe_le,
    signeA: kyc.signe_a,
  };
}

/**
 * Enregistre les réponses du client et sa signature tactile.
 */
async function soumettreKycClient(token, payload, ip, userAgent) {
  if (!token) {
    const err = new Error("Token manquant");
    err.status = 400;
    throw err;
  }

  const kycRes = await pool.query(
    "SELECT id, dossier_id, statut FROM dossier_kyc WHERE token_acces = $1",
    [token]
  );

  if (!kycRes.rows.length) {
    const err = new Error("Fiche KYC introuvable");
    err.status = 404;
    throw err;
  }

  const kycId = kycRes.rows[0].id;
  const dossierId = kycRes.rows[0].dossier_id;

  const donneesKyc = payload.donnees || payload;
  const signatureClient = payload.signature || donneesKyc.signature || null;
  const signeA = payload.signeA || donneesKyc.signeA || "Abidjan";
  const typePersonne = payload.typePersonne || donneesKyc.typePersonne || "physique";

  const updateRes = await pool.query(
    `UPDATE dossier_kyc
     SET statut = 'renseigne',
         type_personne = $1,
         donnees_kyc = $2,
         signature_client = $3,
         signe_le = NOW(),
         signe_a = $4,
         ip_client = $5,
         user_agent_client = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING id, dossier_id, token_acces, statut, type_personne, donnees_kyc, signature_client, signe_le, signe_a`,
    [typePersonne, JSON.stringify(donneesKyc), signatureClient, signeA, ip || null, userAgent || null, kycId]
  );

  // Mettre à jour le nom du comparant dans le dossier s'il a été renseigné
  if (donneesKyc.nomPrenoms && donneesKyc.nomPrenoms.trim()) {
    const nomComplet = donneesKyc.nomPrenoms.trim();
    const compExist = await pool.query("SELECT id FROM dossier_comparants WHERE dossier_id = $1", [dossierId]);
    if (!compExist.rows.length) {
      await pool.query(
        "INSERT INTO dossier_comparants (dossier_id, nom, qualite) VALUES ($1, $2, 'Client principal')",
        [dossierId, nomComplet]
      );
    }
  }

  return updateRes.rows[0];
}

/**
 * Récupère la fiche KYC pour l'office notarial (vue authentifiée).
 */
async function obtenirKycDossier(dossierId) {
  const kycRes = await pool.query(
    `SELECT k.id, k.dossier_id, k.token_acces, k.statut, k.type_personne, k.donnees_kyc, k.signature_client, k.signe_le, k.signe_a,
            k.created_at, k.updated_at, k.valide_le,
            u.nom_complet AS valide_par_nom
     FROM dossier_kyc k
     LEFT JOIN utilisateurs u ON u.id = k.valide_par
     WHERE k.dossier_id = $1`,
    [dossierId]
  );

  if (!kycRes.rows.length) {
    return null;
  }

  const kyc = kycRes.rows[0];
  return {
    id: kyc.id,
    dossierId: kyc.dossier_id,
    token: kyc.token_acces,
    statut: kyc.statut,
    typePersonne: kyc.type_personne,
    donnees: kyc.donnees_kyc || {},
    signature: kyc.signature_client,
    signeLe: kyc.signe_le,
    signeA: kyc.signe_a,
    valideLe: kyc.valide_le,
    valideParNom: kyc.valide_par_nom,
    createdAt: kyc.created_at,
    updatedAt: kyc.updated_at,
  };
}

/**
 * Valide la fiche KYC par le notaire ou le clerc.
 */
async function validerKycDossier(dossierId, utilisateurId) {
  const res = await pool.query(
    `UPDATE dossier_kyc
     SET statut = 'valide',
         valide_par = $1,
         valide_le = NOW(),
         updated_at = NOW()
     WHERE dossier_id = $2
     RETURNING id, statut, valide_le`,
    [utilisateurId, dossierId]
  );

  if (!res.rows.length) {
    const err = new Error("Aucune fiche KYC à valider pour ce dossier");
    err.status = 404;
    throw err;
  }

  return res.rows[0];
}

module.exports = {
  genererOuRecupererTokenKyc,
  obtenirFormulaireKycPublic,
  soumettreKycClient,
  obtenirKycDossier,
  validerKycDossier,
};
