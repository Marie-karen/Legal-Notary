/**
 * src/services/audit.service.js — Journal d'audit générique.
 *
 * Utilisé pour les actions sensibles qui ne sont pas déjà couvertes par
 * `dossier_mouvements` (qui journalise, lui, tout ce qui touche un dossier
 * précis) : modification des paramètres du cabinet, création/désactivation
 * d'un utilisateur, modification du référentiel des actes. Append-only,
 * jamais modifié ni supprimé.
 */

const { pool } = require("../db/pool");

async function consigner(tableCible, ligneId, action, utilisateurId, details) {
  // `details` est une colonne jsonb. node-postgres JSON.stringify les
  // objets simples automatiquement, mais sérialise un TABLEAU JS comme un
  // littéral de tableau PostgreSQL (`{a,b,c}`) plutôt que du JSON — ce qui
  // fait échouer l'insertion si `details` est un tableau (ex.
  // Object.keys(...)). D'où le JSON.stringify explicite ici, qui couvre
  // les deux cas sans que chaque appelant ait à s'en souvenir.
  const detailsObj = details !== undefined && details !== null ? { ...details } : {};
  const UUID_HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uid = utilisateurId && UUID_HEX.test(String(utilisateurId)) ? String(utilisateurId) : null;
  const lid = ligneId && UUID_HEX.test(String(ligneId)) ? String(ligneId) : null;

  if (utilisateurId && !uid) detailsObj.auteurId = utilisateurId;
  if (ligneId && !lid) detailsObj.ligneId = ligneId;

  const detailsJson = Object.keys(detailsObj).length > 0 ? JSON.stringify(detailsObj) : null;

  await pool.query(
    "INSERT INTO journal_audit (table_cible, ligne_id, action, utilisateur_id, details) VALUES ($1, $2, $3, $4, $5)",
    [tableCible, lid, action, uid, detailsJson]
  );
}

module.exports = { consigner };
