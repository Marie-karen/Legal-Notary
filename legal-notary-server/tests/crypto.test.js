/**
 * tests/crypto.test.js — Tests unitaires du chiffrement au repos.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const { chiffrer, dechiffrer, chiffrerObjet, dechiffrerObjet } = require("../src/utils/crypto");

test("crypto — chiffrement et déchiffrement d'une chaîne texte", () => {
  const secret = "MonSuperMotDePasseSMTP123!";
  const chiffre = chiffrer(secret);

  assert.notStrictEqual(chiffre, secret);
  assert.ok(chiffre.startsWith("enc:v1:"));

  const clair = dechiffrer(chiffre);
  assert.strictEqual(clair, secret);
});

test("crypto — rétrocompatibilité avec les données en clair (legacy)", () => {
  const texteClairExistant = "AncienMotDePasseEnClair";
  const resultat = dechiffrer(texteClairExistant);
  assert.strictEqual(resultat, texteClairExistant);
});

test("crypto — idempotence du chiffrement", () => {
  const secret = "SecretUnique";
  const chiffre1 = chiffrer(secret);
  const chiffre2 = chiffrer(chiffre1); // chiffrer une chaîne déjà chiffrée
  assert.strictEqual(chiffre1, chiffre2);
});

test("crypto — gestion des chaînes vides et nulles", () => {
  assert.strictEqual(chiffrer(""), "");
  assert.strictEqual(chiffrer(null), null);
  assert.strictEqual(dechiffrer(""), "");
  assert.strictEqual(dechiffrer(null), null);
});

test("crypto — chiffrement et déchiffrement d'un objet JSON", () => {
  const identifiants = { apiKey: "AK_TEST_123456", senderId: "ETUDE_NOTARIALE", secretToken: "TOKEN_SECRET_987" };
  const chiffre = chiffrerObjet(identifiants);

  assert.ok(chiffre._chiffre);
  assert.ok(chiffre._chiffre.startsWith("enc:v1:"));
  assert.strictEqual(chiffre.apiKey, undefined);

  const restaure = dechiffrerObjet(chiffre);
  assert.deepStrictEqual(restaure, identifiants);
});

test("crypto — objet legacy non chiffré renvoyé tel quel", () => {
  const legacy = { token: "123" };
  const resultat = dechiffrerObjet(legacy);
  assert.deepStrictEqual(resultat, legacy);
});
