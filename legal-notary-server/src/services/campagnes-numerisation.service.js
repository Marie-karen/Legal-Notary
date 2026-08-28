/**
 * src/services/campagnes-numerisation.service.js — Gestion des campagnes de numérisation des archives historiques.
 *
 * Permet le suivi par lot du fonds ancien (1995-2025) :
 *   - Objectif total de dossiers
 *   - Nombre numérisé / en cours / restant
 *   - Statut d'avancement et détection des dossiers incomplets
 */

const { pool } = require("../db/pool");

async function listerCampagnes(etudeId = "a0000000-0000-0000-0000-000000000001") {
  const { rows } = await pool.query(
    `SELECT c.*, u.nom_complet AS responsable_nom
     FROM campagnes_numerisation c
     LEFT JOIN utilisateurs u ON u.id = c.responsable_id
     WHERE c.etude_id = $1
     ORDER BY c.created_at DESC`,
    [etudeId]
  );
  return rows.map((c) => ({
    id: c.id,
    codeCampagne: c.code_campagne,
    intitule: c.intitule,
    anneeDebut: c.annee_debut,
    anneeFin: c.annee_fin,
    typeActesCibles: c.type_actes_cibles,
    totalDossiers: c.total_dossiers,
    dossiersNumerises: c.dossiers_numerises,
    dossiersEnCours: c.dossiers_en_cours,
    dossiersRestants: Math.max(0, c.total_dossiers - c.dossiers_numerises - c.dossiers_en_cours),
    tauxAvancementPct: c.total_dossiers > 0 ? Math.round((c.dossiers_numerises / c.total_dossiers) * 100) : 0,
    statut: c.statut,
    responsableNom: c.responsable_nom,
    notes: c.notes,
    createdAt: c.created_at,
  }));
}

async function creerCampagne({
  etudeId = "a0000000-0000-0000-0000-000000000001",
  intitule,
  anneeDebut,
  anneeFin,
  typeActesCibles = "Tous actes",
  totalDossiers = 1000,
  responsableId = null,
  notes = "",
}) {
  const code = `CAMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
  const { rows } = await pool.query(
    `INSERT INTO campagnes_numerisation
     (etude_id, code_campagne, intitule, annee_debut, annee_fin, type_actes_cibles, total_dossiers, dossiers_numerises, dossiers_en_cours, statut, responsable_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 'en_cours', $8, $9)
     RETURNING *`,
    [
      etudeId,
      code,
      intitule || `Campagne ${anneeDebut} - ${anneeFin}`,
      Number(anneeDebut) || 2010,
      Number(anneeFin) || 2015,
      typeActesCibles,
      Number(totalDossiers) || 1000,
      responsableId,
      notes,
    ]
  );
  return rows[0];
}

async function enregistrerAvancementLot({
  campagneId,
  nombreNumerisesAjoutes = 1,
  nombreEnCours = 0,
}) {
  const { rows } = await pool.query(
    `UPDATE campagnes_numerisation
     SET dossiers_numerises = dossiers_numerises + $1,
         dossiers_en_cours = GREATEST(0, dossiers_en_cours + $2),
         updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [nombreNumerisesAjoutes, nombreEnCours, campagneId]
  );
  return rows[0];
}

module.exports = {
  listerCampagnes,
  creerCampagne,
  enregistrerAvancementLot,
};
