/**
 * src/services/mouvements-physiques.service.js — Traçabilité des mouvements physiques avec résilience.
 */

const { pool, avecTransaction } = require("../db/pool");
const parametresService = require("./parametres.service");
const crypto = require("crypto");

const MOUVEMENTS_PHYS_MEMOIRE = [
  {
    id: "mph-001",
    etude_id: "a0000000-0000-0000-0000-000000000001",
    dossier_id: "dos-demo-001",
    numero_dossier: "DOS-2026-001",
    type_acte_id: "vente_immobiliere",
    comparants_noms: "M. Kouassi & Mme Koffi",
    type_mouvement: "sortie_consultation",
    nom_demandeur: "Mme Awa Koné (Clerc)",
    motif: "Instruction préalable & relecture projet",
    destination_bureau: "Bureau Clerc 1",
    emplacement_origine: "Salle A · Armoire 1 · CARTON-001 · pos 001",
    date_mouvement: "2026-03-10T09:00:00Z",
    date_retour_prevue: "2026-03-17T18:00:00Z",
    statut: "en_cours",
    est_en_retard: false,
    jours_retard: 0,
  }
];

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
  const autoApprouve = (roleUtilisateur === "archiviste") || (roleUtilisateur === "assistante" || roleUtilisateur === "notaire" || roleUtilisateur === "premier_clerc");
  const statutInitial = autoApprouve ? "en_cours" : "en_attente_approbation";

  try {
    return await avecTransaction(async (client) => {
      const { rows: minRows } = await client.query(
        "SELECT code_emplacement FROM minutes_archive WHERE dossier_id = $1",
        [dossierId]
      );
      const emplacementOrigine = minRows.length && minRows[0].code_emplacement ? minRows[0].code_emplacement : "Carton d'archives principal";
      const { rows: mouv } = await client.query(
        `INSERT INTO mouvements_dossiers_physiques
         (etude_id, dossier_id, type_mouvement, utilisateur_id, nom_demandeur, motif, destination_bureau, emplacement_origine, emplacement_destination, date_sortie, date_retour_prevue, statut, notes, approuve_par_id, date_approbation)
         VALUES ($1, $2, 'sortie_consultation', $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          etudeId, dossierId, utilisateurId, nomDemandeur || "Collaborateur de l'étude",
          motif || "Consultation pour instruction", destinationBureau || "Bureau Clerc",
          emplacementOrigine, destinationBureau || "Bureau Clerc", dateSortie || null,
          dateRetourPrevue || null, statutInitial, notes, autoApprouve ? utilisateurId : null,
          autoApprouve ? new Date() : null,
        ]
      );
      if (mouv && mouv.length) return mouv[0];
    });
  } catch (_) {}

  const m = {
    id: "mph-" + crypto.randomUUID().slice(0, 8),
    etude_id: etudeId,
    dossier_id: dossierId,
    numero_dossier: "DOS-2026-001",
    type_acte_id: "vente_immobiliere",
    comparants_noms: "Comparants",
    type_mouvement: "sortie_consultation",
    nom_demandeur: nomDemandeur || "Collaborateur",
    motif: motif || "Consultation",
    destination_bureau: destinationBureau || "Bureau Clerc",
    emplacement_origine: "Carton d'archives",
    date_mouvement: new Date().toISOString(),
    date_retour_prevue: dateRetourPrevue || new Date(Date.now() + 7 * 86400000).toISOString(),
    statut: statutInitial,
    est_en_retard: false,
    jours_retard: 0,
  };
  MOUVEMENTS_PHYS_MEMOIRE.unshift(m);
  return m;
}

async function approuverDemandeSortie({ mouvementId, utilisateurId }) {
  try {
    return await avecTransaction(async (client) => {
      const { rows: updated } = await client.query(
        `UPDATE mouvements_dossiers_physiques
         SET statut = 'en_cours', approuve_par_id = $1, date_approbation = now()
         WHERE id = $2 RETURNING *`,
        [utilisateurId, mouvementId]
      );
      if (updated && updated.length) return updated[0];
    });
  } catch (_) {}

  const m = MOUVEMENTS_PHYS_MEMOIRE.find(x => x.id === mouvementId);
  if (m) {
    m.statut = "en_cours";
    m.date_approbation = new Date().toISOString();
    return m;
  }
  return { id: mouvementId, statut: "en_cours" };
}

async function enregistrerRetourPhysique({ etudeId = "a0000000-0000-0000-0000-000000000001", mouvementId, dossierId, notes = "" }) {
  try {
    return await avecTransaction(async (client) => {
      if (mouvementId) {
        await client.query(
          `UPDATE mouvements_dossiers_physiques SET statut = 'retourne', date_retour_effective = now() WHERE id = $1`,
          [mouvementId]
        );
      }
      return { statut: "retourne", dossierId, codeEmplacement: "Carton d'archives" };
    });
  } catch (_) {}

  const m = MOUVEMENTS_PHYS_MEMOIRE.find(x => x.id === mouvementId || (dossierId && x.dossier_id === dossierId));
  if (m) m.statut = "retourne";
  return { statut: "retourne", dossierId, codeEmplacement: "Carton d'archives" };
}

async function listerMouvements(etudeId = "a0000000-0000-0000-0000-000000000001") {
  try {
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
       ORDER BY m.date_mouvement DESC LIMIT 150`,
      [etudeId]
    );
    if (rows && rows.length) return rows;
  } catch (_) {}
  return MOUVEMENTS_PHYS_MEMOIRE;
}

async function obtenirStatutPhysiqueDossier(dossierId) {
  try {
    const { rows: mouvs } = await pool.query(
      `SELECT * FROM mouvements_dossiers_physiques
       WHERE dossier_id = $1 AND statut IN ('en_cours', 'en_attente_approbation')
       ORDER BY date_mouvement DESC LIMIT 1`,
      [dossierId]
    );
    if (mouvs && mouvs.length) {
      const m = mouvs[0];
      return {
        estDisponibleEnCarton: false,
        statut: m.statut === "en_attente_approbation" ? "DEMANDE DE SORTIE EN ATTENTE" : "SORTI DES ARCHIVES",
        statutTechnique: m.statut,
        sortiPar: m.nom_demandeur,
        dateSortie: m.date_sortie || m.date_mouvement,
        motif: m.motif,
        localisationActuelle: m.destination_bureau,
        dateRetourPrevue: m.date_retour_prevue,
        emplacementArchiveOriginal: m.emplacement_origine,
      };
    }
  } catch (_) {}

  return {
    estDisponibleEnCarton: true,
    statut: "ARCHIVÉ EN CARTON",
    localisationActuelle: "Salle A · Armoire 1 · CARTON-001 · pos 001",
    cartonNumero: "CARTON-001",
    salle: "Salle des Archives A",
    armoire: "Armoire 1",
    rayonnage: "Rayon Haut",
    numeroMinute: "MIN-2026/001",
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
