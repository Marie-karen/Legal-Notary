/**
 * src/services/audit.service.js — Journal d'audit d'office notarial.
 *
 * Utilisé pour les actions sensibles qui ne sont pas déjà couvertes par
 * `dossier_mouvements` (qui journalise, lui, tout ce qui touche un dossier
 * précis) : modification des paramètres du cabinet, création/désactivation
 * d'un utilisateur, modification du référentiel des actes.
 * (Note : l'immuabilité et le scellement cryptographique WORM seront traités en S17).
 */

const { pool } = require("../db/pool");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function consigner(tableCible, ligneId, action, utilisateurId, details) {
  // Règle de sécurité : un événement ne doit JAMAIS être enregistré sans
  // l'identifiant de son auteur ou de sa cible. Si l'un des identifiants est
  // manquant ou n'a pas un format UUID valide pour PostgreSQL, l'action échoue
  // explicitement plutôt que d'insérer une valeur vide (null).
  if (!utilisateurId || !UUID_REGEX.test(String(utilisateurId))) {
    const err = new Error(
      `Identifiant auteur invalide ou manquant (${utilisateurId}) pour la journalisation d'audit de l'action ${action} sur ${tableCible}.`
    );
    err.code = "AUDIT_AUTEUR_INVALIDE";
    err.status = 500;
    throw err;
  }

  if (!ligneId || !UUID_REGEX.test(String(ligneId))) {
    const err = new Error(
      `Identifiant cible invalide ou manquant (${ligneId}) pour la journalisation d'audit de l'action ${action} sur ${tableCible}.`
    );
    err.code = "AUDIT_CIBLE_INVALIDE";
    err.status = 500;
    throw err;
  }

  // `details` est une colonne jsonb. node-postgres JSON.stringify les
  // objets simples automatiquement, mais sérialise un TABLEAU JS comme un
  // littéral de tableau PostgreSQL (`{a,b,c}`) plutôt que du JSON — ce qui
  // fait échouer l'insertion si `details` est un tableau (ex.
  // Object.keys(...)). D'où le JSON.stringify explicite ici, qui couvre
  // les deux cas sans que chaque appelant ait à s'en souvenir.
  const detailsJson = details === undefined || details === null ? null : JSON.stringify(details);

  await pool.query(
    "INSERT INTO journal_audit (table_cible, ligne_id, action, utilisateur_id, details) VALUES ($1, $2, $3, $4, $5)",
    [tableCible, ligneId, action, utilisateurId, detailsJson]
  );
}

module.exports = { consigner };
