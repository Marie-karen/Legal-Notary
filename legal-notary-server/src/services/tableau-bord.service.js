/**
 * src/services/tableau-bord.service.js — Statistiques d'évolution par clerc.
 *
 * Demande du 2026-08-25 : « le clerc voit lui-même ses dossiers, son
 * évolution sur les dossiers, ses retards ». Ce service calcule ces
 * chiffres pour UN utilisateur (le clerc regarde les siens, le notaire
 * peut regarder ceux de n'importe qui — la restriction est faite dans la
 * route, pas ici).
 */

const { pool } = require("../db/pool");

async function obtenirEvolutionUtilisateur(utilisateurId) {
  const { rows: actifs } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM dossiers WHERE clerc_assigne_id = $1 AND statut = 'actif' AND archived_at IS NULL",
    [utilisateurId]
  );
  const { rows: clotures30j } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM minutes_archive m JOIN dossiers d ON d.id = m.dossier_id
     WHERE d.clerc_assigne_id = $1 AND m.date_cloture >= CURRENT_DATE - INTERVAL '30 days'`,
    [utilisateurId]
  );
  const { rows: avancement } = await pool.query(
    `SELECT COALESCE(AVG(
       CASE t.statut
         WHEN 'effectuee' THEN 100 WHEN 'depot_effectue' THEN 75
         WHEN 'en_cours' THEN 50 WHEN 'attente_client' THEN 25 ELSE 0
       END
     ), 0)::int AS moyenne
     FROM dossier_taches t
     JOIN dossiers d ON d.id = t.dossier_id
     WHERE d.clerc_assigne_id = $1 AND d.statut = 'actif' AND d.archived_at IS NULL`,
    [utilisateurId]
  );

  return {
    dossiersActifs: actifs[0].n,
    dossiersClotures30Jours: clotures30j[0].n,
    avancementMoyenPourcent: avancement[0].moyenne,
  };
}

module.exports = { obtenirEvolutionUtilisateur };
