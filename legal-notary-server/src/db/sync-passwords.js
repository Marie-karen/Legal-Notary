/**
 * src/db/sync-passwords.js — Script désactivé (Audit S01 / S07).
 * Ce script est désactivé et refuse de s'exécuter.
 * Il sera déplacé et sécurisé avec un garde-fou strict dans scripts/demo/ lors de S07.
 */

async function syncPasswords() {
  throw new Error(
    "DÉSACTIVÉ : sync-passwords.js est désactivé pour empêcher l'écrasement de mots de passe. Ce script sera déplacé et sécurisé dans scripts/demo/ lors du correctif S07."
  );
}

if (require.main === module) {
  console.error(
    "❌ [SÉCURITÉ S01] Ce script est désactivé. Il sera déplacé et sécurisé avec garde-fou dans scripts/demo/ en S07."
  );
  process.exit(1);
}

module.exports = { syncPasswords };
