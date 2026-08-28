/**
 * src/services/mouvements-physiques.service.js — Traçabilité des mouvements physiques des dossiers papier.
 *
 * Gère les sorties pour consultation en bureau, les retours en carton physique,
 * les alertes de retard et l'historique complet des déplacements de chaque dossier.
 */

const { pool, avecTransaction } = require("../db/pool");

async function enregistrerSortiePhysique({
  etudeId = "a0000000-0000-0000-0000-000000000001",
  dossierId,
  utilisateurId,
  nomDemandeur,
  motif,
  destinationBureau,
  dateRetourPrevue,
  notes = "",
}) {
  return avecTransaction(async (client) => {
    // 1. Récupérer l'emplacement d'origine
    const { rows: minRows } = await client.query(
      "SELECT code_emplacement FROM minutes_archive WHERE dossier_id = $1",
      [dossierId]
    );
    const emplacementOrigine = minRows.length && minRows[0].code_emplacement ? minRows[0].code_emplacement : "Carton d'archives principal";

    // 2. Insérer le mouvement
    const { rows: mouv } = await client.query(
      `INSERT INTO mouvements_dossiers_physiques
       (etude_id, dossier_id, type_mouvement, utilisateur_id, nom_demandeur, motif, destination_bureau, emplacement_origine, emplacement_destination, date_retour_prevue, statut, notes)
       VALUES ($1, $2, 'sortie_consultation', $3, $4, $5, $6, $7, $8, $9, 'en_cours', $10)
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
        dateRetourPrevue || null,
        notes,
      ]
    );

    // 3. Mettre à jour l'emplacement temporaire sur les documents physiques
    await client.query(
      "UPDATE documents_physiques SET statut_physique = 'sorti_consultation', localisation_actuelle = $1 WHERE dossier_id = $2",
      [destinationBureau, dossierId]
    );

    return mouv[0];
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
    // Clôturer le mouvement
    let cibleMouvementId = mouvementId;
    if (!cibleMouvementId && dossierId) {
      const { rows: actifs } = await client.query(
        "SELECT id FROM mouvements_dossiers_physiques WHERE dossier_id = $1 AND statut = 'en_cours' ORDER BY date_mouvement DESC LIMIT 1",
        [dossierId]
      );
      if (actifs.length) cibleMouvementId = actifs[0].id;
    }

    if (cibleMouvementId) {
      await client.query(
        `UPDATE mouvements_dossiers_physiques
         SET statut = 'retourne', date_retour_effective = now(), notes = COALESCE(notes, '') || ' ' || $1
         WHERE id = $2`,
        [notes ? `[Retour: ${notes}]` : "[Retourné aux archives]", cibleMouvementId]
      );
    }

    // Récupérer l'emplacement officiel en carton
    const { rows: minRows } = await client.query(
      "SELECT code_emplacement FROM minutes_archive WHERE dossier_id = $1",
      [dossierId]
    );
    const codeEmplacement = minRows.length ? minRows[0].code_emplacement : "Carton principal";

    // Remettre le statut physique à 'archive'
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
            u.nom_complet AS enregistre_par_nom
     FROM mouvements_dossiers_physiques m
     JOIN dossiers d ON d.id = m.dossier_id
     LEFT JOIN dossier_comparants c ON c.dossier_id = d.id
     LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
     WHERE m.etude_id = $1
     GROUP BY m.id, d.id, u.id
     ORDER BY m.date_mouvement DESC LIMIT 100`,
    [etudeId]
  );
  return rows;
}

async function obtenirStatutPhysiqueDossier(dossierId) {
  const { rows: mouvs } = await pool.query(
    `SELECT * FROM mouvements_dossiers_physiques
     WHERE dossier_id = $1 AND statut = 'en_cours'
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
    return {
      estDisponibleEnCarton: false,
      statut: "SORTI DES ARCHIVES",
      sortiPar: m.nom_demandeur,
      dateSortie: m.date_mouvement,
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
  enregistrerSortiePhysique,
  enregistrerRetourPhysique,
  listerMouvements,
  obtenirStatutPhysiqueDossier,
};
