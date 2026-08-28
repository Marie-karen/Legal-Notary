/**
 * tests/notifications.service.test.js — Rendu des modèles de message.
 *
 * Seule `rendreModele` est une fonction pure testable sans base de
 * données ; le reste de notifications.service.js (résolution des
 * destinataires, envoi SMTP/SMS/push) est vérifié par un test
 * d'intégration réel (voir tests manuels documentés dans
 * docs/NOTIFICATIONS.md) car il dépend de la base et de services externes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { rendreModele } = require("../src/services/notifications.service");

test("rendreModele — remplace tous les espaces réservés fournis", () => {
  const resultat = rendreModele("Dossier {{numeroDossier}} soumis par {{nomRedacteur}}", {
    numeroDossier: "DOS-2026-004",
    nomRedacteur: "Fatou Koné",
  });
  assert.equal(resultat, "Dossier DOS-2026-004 soumis par Fatou Koné");
});

test("rendreModele — laisse un espace réservé inconnu tel quel (jamais une exception)", () => {
  const resultat = rendreModele("Bonjour {{prenom}}, dossier {{numeroDossier}}", { numeroDossier: "DOS-2026-004" });
  assert.equal(resultat, "Bonjour {{prenom}}, dossier DOS-2026-004");
});

test("rendreModele — texte vide/nul renvoyé tel quel", () => {
  assert.equal(rendreModele(null, {}), null);
  assert.equal(rendreModele("", {}), "");
});

test("rendreModele — même espace réservé répété plusieurs fois", () => {
  const resultat = rendreModele("{{numeroDossier}} — voir {{numeroDossier}}", { numeroDossier: "DOS-2026-004" });
  assert.equal(resultat, "DOS-2026-004 — voir DOS-2026-004");
});
