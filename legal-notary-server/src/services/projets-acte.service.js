/**
 * src/services/projets-acte.service.js — Rédaction et révision des actes.
 *
 * Circuit demandé le 2026-08-25 : le clerc rédige (par défaut dans
 * l'éditeur intégré à l'application — voir `contenu` ; c'est volontairement
 * optionnel, un notaire qui préfère un autre mode de travail peut se
 * contenter de `pieceJointeUrl`, voir la migration 002), soumet ; le
 * notaire est notifié sur tous les canaux configurés (email, SMS,
 * WhatsApp, push, fil in-app — voir notifications.service.js) ; il peut
 * modifier directement dans l'application OU imprimer, corriger sur
 * papier, puis renvoyer pour correction avec un commentaire — ce qui
 * notifie le clerc à son tour pour qu'il reprenne le dossier.
 *
 * Append-only par version (voir migration) : chaque étape du circuit crée
 * une nouvelle ligne, l'historique complet des allers-retours reste
 * consultable, jamais de réécriture sur place.
 */

const { pool, avecTransaction } = require("../db/pool");
const dossiersService = require("./dossiers.service");
const notificationsService = require("./notifications.service");

function versCamel(l) {
  return {
    id: l.id,
    dossierId: l.dossier_id,
    numeroVersion: l.numero_version,
    contenu: l.contenu,
    pieceJointeUrl: l.piece_jointe_url,
    statut: l.statut,
    redigeParId: l.redige_par_id,
    soumisLe: l.soumis_le,
    decisionParId: l.decision_par_id,
    decisionLe: l.decision_le,
    commentaireDecision: l.commentaire_decision,
    createdAt: l.created_at,
  };
}

async function obtenirVersionActuelle(dossierId) {
  const { rows } = await pool.query(
    "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC LIMIT 1",
    [dossierId]
  );
  return rows.length ? versCamel(rows[0]) : null;
}

async function listerHistorique(dossierId) {
  const { rows } = await pool.query(
    "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC",
    [dossierId]
  );
  return rows.map(versCamel);
}

/**
 * Crée ou met à jour le brouillon en cours (statut 'en_redaction').
 * Si la dernière version n'est pas 'en_redaction' (ex. 'a_corriger'), une
 * nouvelle version est ouverte pour continuer le circuit — le clerc part
 * du commentaire de correction, pas de zéro.
 */
async function enregistrerBrouillon(dossierId, { contenu, pieceJointeUrl }, utilisateurId) {
  return avecTransaction(async (client) => {
    const { rows: dernieres } = await client.query(
      "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC LIMIT 1",
      [dossierId]
    );
    const derniere = dernieres[0];

    if (derniere && derniere.statut === "en_redaction") {
      const { rows } = await client.query(
        "UPDATE dossier_projets_acte SET contenu = $1, piece_jointe_url = $2 WHERE id = $3 RETURNING *",
        [contenu, pieceJointeUrl || null, derniere.id]
      );
      return versCamel(rows[0]);
    }

    const prochainNumero = derniere ? derniere.numero_version + 1 : 1;
    const { rows } = await client.query(
      `INSERT INTO dossier_projets_acte (dossier_id, numero_version, contenu, piece_jointe_url, statut, redige_par_id)
       VALUES ($1, $2, $3, $4, 'en_redaction', $5) RETURNING *`,
      [dossierId, prochainNumero, contenu, pieceJointeUrl || null, utilisateurId]
    );
    return versCamel(rows[0]);
  });
}

/**
 * Le clerc soumet le brouillon au notaire : passe 'soumis', notifie le
 * notaire sur tous les canaux actifs (événement 'projet_acte_soumis').
 */
async function soumettre(dossierId, utilisateurId) {
  return avecTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE dossier_projets_acte SET statut = 'soumis', soumis_le = now()
       WHERE id = (
         SELECT id FROM dossier_projets_acte WHERE dossier_id = $1 AND statut = 'en_redaction'
         ORDER BY numero_version DESC LIMIT 1
       ) RETURNING *`,
      [dossierId]
    );
    if (!rows.length) return null;

    const { rows: dossierRows } = await client.query("SELECT * FROM dossiers WHERE id = $1", [dossierId]);
    const { rows: redacteurRows } = await client.query("SELECT nom_complet FROM utilisateurs WHERE id = $1", [utilisateurId]);
    await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, "Projet d'acte soumis au notaire pour validation");

    await notificationsService.declencherEvenement("projet_acte_soumis", {
      dossierId,
      donnees: {
        numeroDossier: dossierRows[0].numero_dossier,
        typeActe: dossierRows[0].type_acte_id, // libellé résolu côté frontend si besoin, id suffisant pour tracer
        nomRedacteur: redacteurRows[0] ? redacteurRows[0].nom_complet : "un clerc",
      },
    });

    return versCamel(rows[0]);
  });
}

/**
 * Le notaire valide : passe 'valide', définitif pour cette version, notifie
 * le clerc (événement 'projet_acte_valide').
 */
async function valider(dossierId, utilisateurId, commentaire) {
  return avecTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE dossier_projets_acte SET statut = 'valide', decision_par_id = $1, decision_le = now(), commentaire_decision = $2
       WHERE id = (
         SELECT id FROM dossier_projets_acte WHERE dossier_id = $3 AND statut = 'soumis'
         ORDER BY numero_version DESC LIMIT 1
       ) RETURNING *`,
      [utilisateurId, commentaire || null, dossierId]
    );
    if (!rows.length) return null;

    const { rows: dossierRows } = await client.query("SELECT numero_dossier FROM dossiers WHERE id = $1", [dossierId]);
    await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, "Projet d'acte validé par le notaire");
    await notificationsService.declencherEvenement("projet_acte_valide", {
      dossierId,
      donnees: { numeroDossier: dossierRows[0].numero_dossier },
    });
    return versCamel(rows[0]);
  });
}

/**
 * Le notaire renvoie pour correction (qu'il ait modifié directement dans
 * l'application ou imprimé/annoté sur papier) : passe 'a_corriger' avec un
 * commentaire obligatoire, notifie le clerc assigné pour qu'il reprenne
 * la main (événement 'projet_acte_a_corriger').
 */
async function renvoyerPourCorrection(dossierId, utilisateurId, commentaire) {
  if (!commentaire || !commentaire.trim()) {
    throw new Error("Un commentaire est requis pour renvoyer un projet d'acte en correction.");
  }
  return avecTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE dossier_projets_acte SET statut = 'a_corriger', decision_par_id = $1, decision_le = now(), commentaire_decision = $2
       WHERE id = (
         SELECT id FROM dossier_projets_acte WHERE dossier_id = $3 AND statut = 'soumis'
         ORDER BY numero_version DESC LIMIT 1
       ) RETURNING *`,
      [utilisateurId, commentaire, dossierId]
    );
    if (!rows.length) return null;

    const { rows: dossierRows } = await client.query("SELECT numero_dossier FROM dossiers WHERE id = $1", [dossierId]);
    await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, `Projet d'acte renvoyé pour correction : ${commentaire}`);
    await notificationsService.declencherEvenement("projet_acte_a_corriger", {
      dossierId,
      donnees: { numeroDossier: dossierRows[0].numero_dossier, commentaire },
    });
    return versCamel(rows[0]);
  });
}

module.exports = {
  obtenirVersionActuelle,
  listerHistorique,
  enregistrerBrouillon,
  soumettre,
  valider,
  renvoyerPourCorrection,
};
