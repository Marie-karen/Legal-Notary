/**
 * src/services/mouvements-physiques.service.js — Traçabilité des mouvements physiques des dossiers papier.
 *
 * Gère les demandes de sorties physiques, l'approbation par l'archiviste (ou l'assistante en cas d'absence d'archiviste),
 * les retours en carton physique, les alertes de non-respect / retard et l'historique complet.
 */

const { pool, avecTransaction } = require("../db/pool");
const parametresService = require("./parametres.service");

async function enregistrerDemandeSortie({
  etudeId = "a0000000-0000-0000-0000-000000000001",
  dossierId,
  utilisateurId,
  roleUtilisateur,
  nomDemandeur,
  motif,
  destinationBureau,
  dateSortie = null,
  dateRetourPrevue,
  notes = "",
}) {
  const params = await parametresService.obtenir();
  const presenceArchiviste = params.presenceArchiviste !== false;

  return avecTransaction(async (client) => {
    // Emplacement d'origine
    const { rows: minRows } = await client.query(
      "SELECT code_emplacement FROM minutes_archive WHERE dossier_id = $1",
      [dossierId]
    );
    const emplacementOrigine = minRows.length && minRows[0].code_emplacement ? minRows[0].code_emplacement : "Carton d'archives principal";

    // Détermination de l'approbation :
    // Si l'utilisateur est archiviste (ou si pas d'archiviste et rôle notaire/assistante/premier_clerc) -> auto-approuvé
    const autoApprouve = (roleUtilisateur === "archiviste") ||
      (presenceArchiviste === false && (roleUtilisateur === "assistante" || roleUtilisateur === "notaire" || roleUtilisateur === "premier_clerc"));

    const statutInitial = autoApprouve ? "en_cours" : "en_attente_approbation";
    const dateApprobation = autoApprouve ? new Date() : null;
    const approuvePar = autoApprouve ? utilisateurId : null;

    const { rows: mouv } = await client.query(
      `INSERT INTO mouvements_dossiers_physiques
       (etude_id, dossier_id, type_mouvement, utilisateur_id, nom_demandeur, motif, destination_bureau, emplacement_origine, emplacement_destination, date_sortie, date_retour_prevue, statut, notes, approuve_par_id, date_approbation)
       VALUES ($1, $2, 'sortie_consultation', $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        etudeId,
        dossierId,
        utilisateurId,
        nomDemandeur || "Collaborateur de l'étude",
        motif || "Consultation pour instruction",
        destinationBureau || "Bureau Clerc",
        emplacementOrigine,
        destinationBureau || "Bureau Clerc",
        dateSortie || null,
        dateRetourPrevue || null,
        statutInitial,
        notes,
        approuvePar,
        dateApprobation,
      ]
    );

    if (autoApprouve) {
      await client.query(
        "UPDATE documents_physiques SET statut_physique = 'sorti_consultation', localisation_actuelle = $1 WHERE dossier_id = $2",
        [destinationBureau, dossierId]
      );
    }

    return mouv[0];
  });
}

async function approuverDemandeSortie({
  mouvementId,
  utilisateurId,
}) {
  return avecTransaction(async (client) => {
    const { rows: exist } = await client.query(
      "SELECT * FROM mouvements_dossiers_physiques WHERE id = $1",
      [mouvementId]
    );
    if (!exist.length) throw new Error("Demande de sortie introuvable.");

    const m = exist[0];
    const { rows: updated } = await client.query(
      `UPDATE mouvements_dossiers_physiques
       SET statut = 'en_cours', approuve_par_id = $1, date_approbation = now()
       WHERE id = $2
       RETURNING *`,
      [utilisateurId, mouvementId]
    );

    await client.query(
      "UPDATE documents_physiques SET statut_physique = 'sorti_consultation', localisation_actuelle = $1 WHERE dossier_id = $2",
      [m.destination_bureau, m.dossier_id]
    );

    return updated[0];
  });
}

async function enregistrerRetourPhysique({
  etudeId = "a0000000-0000-0000-0000-000000000001",
  mouvementId,
  dossierId,
  cartonId = null,
  position = null,
  notes = "",
}) {
  return avecTransaction(async (client) => {
    let cibleMouvementId = mouvementId;
    if (!cibleMouvementId && dossierId) {
      const { rows: actifs } = await client.query(
        "SELECT id FROM mouvements_dossiers_physiques WHERE dossier_id = $1 AND statut IN ('en_cours', 'en_attente_approbation') ORDER BY date_mouvement DESC LIMIT 1",
        [dossierId]
      );
      if (actifs.length) cibleMouvementId = actifs[0].id;
    }

    if (cibleMouvementId) {
      await client.query(
        `UPDATE mouvements_dossiers_physiques
         SET statut = 'retourne', date_retour_effective = now(), notes = COALESCE(notes, '') || ' ' || $1
         WHERE id = $2`,
        [notes ? `[Retour: ${notes}]` : "[Dossier restitué et réintégré]", cibleMouvementId]
      );
    }

    // Récupérer l'emplacement officiel en carton
    const { rows: minRows } = await client.query(
      "SELECT code_emplacement FROM minutes_archive WHERE dossier_id = $1",
      [dossierId]
    );
    const codeEmplacement = minRows.length ? minRows[0].code_emplacement : "Carton principal";

    await client.query(
      "UPDATE documents_physiques SET statut_physique = 'archive', localisation_actuelle = $1 WHERE dossier_id = $2",
      [codeEmplacement, dossierId]
    );

    return { statut: "retourne", dossierId, codeEmplacement };
  });
}

async function listerMouvements(etudeId = "a0000000-0000-0000-0000-000000000001") {
  const { rows } = await pool.query(
    `SELECT m.*, d.numero_dossier, d.type_acte_id,
            COALESCE(string_agg(c.nom || ' (' || c.qualite || ')', ', '), '') AS comparants_noms,
            u.nom_complet AS enregistre_par_nom,
            u_appr.nom_complet AS approuve_par_nom,
            (m.statut = 'en_cours' AND m.date_retour_prevue IS NOT NULL AND m.date_retour_prevue < CURRENT_DATE) AS est_en_retard,
            CASE 
              WHEN m.statut = 'en_cours' AND m.date_retour_prevue IS NOT NULL AND m.date_retour_prevue < CURRENT_DATE 
              THEN (CURRENT_DATE - m.date_retour_prevue)::int
              ELSE 0 
            END AS jours_retard
     FROM mouvements_dossiers_physiques m
     JOIN dossiers d ON d.id = m.dossier_id
     LEFT JOIN dossier_comparants c ON c.dossier_id = d.id
     LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
     LEFT JOIN utilisateurs u_appr ON u_appr.id = m.approuve_par_id
     WHERE m.etude_id = $1
     GROUP BY m.id, d.id, u.id, u_appr.id
     ORDER BY 
       CASE 
         WHEN m.statut = 'en_attente_approbation' THEN 1
         WHEN (m.statut = 'en_cours' AND m.date_retour_prevue < CURRENT_DATE) THEN 2
         WHEN m.statut = 'en_cours' THEN 3
         ELSE 4
       END,
       m.date_mouvement DESC LIMIT 150`,
    [etudeId]
  );
  return rows;
}

async function obtenirStatutPhysiqueDossier(dossierId) {
  const { rows: mouvs } = await pool.query(
    `SELECT * FROM mouvements_dossiers_physiques
     WHERE dossier_id = $1 AND statut IN ('en_cours', 'en_attente_approbation')
     ORDER BY date_mouvement DESC LIMIT 1`,
    [dossierId]
  );

  const { rows: mins } = await pool.query(
    `SELECT m.code_emplacement, m.numero_minute, k.numero_carton, k.salle, k.armoire, k.rayonnage
     FROM minutes_archive m
     LEFT JOIN cartons_archive k ON k.id = m.carton_id
     WHERE m.dossier_id = $1`,
    [dossierId]
  );

  if (mouvs.length) {
    const m = mouvs[0];
    const enAttente = (m.statut === "en_attente_approbation");
    return {
      estDisponibleEnCarton: false,
      statut: enAttente ? "DEMANDE DE SORTIE EN ATTENTE" : "SORTI DES ARCHIVES",
      statutTechnique: m.statut,
      sortiPar: m.nom_demandeur,
      dateSortie: m.date_sortie || m.date_mouvement,
      motif: m.motif,
      localisationActuelle: m.destination_bureau,
      dateRetourPrevue: m.date_retour_prevue,
      emplacementArchiveOriginal: m.emplacement_origine,
    };
  }

  const min = mins.length ? mins[0] : null;
  return {
    estDisponibleEnCarton: true,
    statut: "ARCHIVÉ EN CARTON",
    localisationActuelle: min && min.code_emplacement ? min.code_emplacement : "En attente de carton",
    cartonNumero: min ? min.numero_carton : null,
    salle: min ? min.salle : null,
    armoire: min ? min.armoire : null,
    rayonnage: min ? min.rayonnage : null,
    numeroMinute: min ? min.numero_minute : null,
  };
}

module.exports = {
  enregistrerSortiePhysique: enregistrerDemandeSortie,
  enregistrerDemandeSortie,
  approuverDemandeSortie,
  enregistrerRetourPhysique,
  listerMouvements,
  obtenirStatutPhysiqueDossier,
};
