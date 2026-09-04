/**
 * tests/internal-control.test.js
 *
 * Tests unitaires et d'intégration pour l'API d'Administration Interne
 * et la passerelle avec le SaaS de Contrôle Centralisé (Master Super Admin Hub).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { pool } = require("../src/db/pool");
const internalControlService = require("../src/services/internal-control.service");
const { notifyControlHub } = require("../src/services/webhook-dispatcher.service");
const { exigerCleControlHub } = require("../src/middleware/controlHubAuth.middleware");

test("Control Hub — 1. Middleware de sécurité et rejet 401", async (t) => {
  const secretCorrect = process.env.CONTROL_HUB_SECRET_KEY || "cle_secrete_ultra_securisee";

  // Cas 1 : Aucune clé fournie -> 401
  let statutReponse = null;
  let corpsReponse = null;
  const mockReqSansCle = { headers: {} };
  const mockRes1 = {
    status: (code) => {
      statutReponse = code;
      return { json: (data) => { corpsReponse = data; } };
    },
  };
  exigerCleControlHub(mockReqSansCle, mockRes1, () => {});
  assert.equal(statutReponse, 401);
  assert.ok(corpsReponse.erreur.includes("requis"));

  // Cas 2 : Mauvaise clé fournie -> 401
  const mockReqMauvaiseCle = { headers: { "x-control-hub-secret": "cle_erronee_hacker" } };
  exigerCleControlHub(mockReqMauvaiseCle, mockRes1, () => {});
  assert.equal(statutReponse, 401);
  assert.ok(corpsReponse.erreur.includes("invalide"));

  // Cas 3 : Bonne clé via x-control-hub-secret -> succès (next() appelé)
  let nextAppele = false;
  const mockReqOk = { headers: { "x-control-hub-secret": secretCorrect } };
  exigerCleControlHub(mockReqOk, mockRes1, () => { nextAppele = true; });
  assert.equal(nextAppele, true);
  assert.equal(mockReqOk.estControlHub, true);

  // Cas 4 : Bonne clé via Authorization: Bearer -> succès
  let nextBearerAppele = false;
  const mockReqBearerOk = { headers: { authorization: `Bearer ${secretCorrect}` } };
  exigerCleControlHub(mockReqBearerOk, mockRes1, () => { nextBearerAppele = true; });
  assert.equal(nextBearerAppele, true);
});

test("Control Hub — 2. Endpoint Healthcheck (obtenirHealth)", async () => {
  const health = await internalControlService.obtenirHealth();
  assert.equal(health.status, "healthy");
  assert.equal(health.service, "legal-notary-server");
  assert.equal(health.database.status, "connected");
  assert.ok(typeof health.database.pingMs === "number");
  assert.ok(health.timestamp);
  assert.ok(health.uptimeSeconds >= 0);
  assert.ok(health.system.nodeVersion);
});

test("Control Hub — 3. Endpoint Statistiques SaaS (obtenirStats)", async () => {
  const stats = await internalControlService.obtenirStats();
  assert.ok(stats.totalUsers >= 1);
  assert.ok(typeof stats.newUsers7d === "number");
  assert.ok(typeof stats.newUsers30d === "number");
  assert.ok(typeof stats.activeUsers === "number");
  assert.ok(typeof stats.activePaidSubscriptions === "number");
  assert.ok(stats.estimatedMRR.amountFCFA >= 0);
  assert.ok(stats.businessMetrics.totalDossiers >= 0);
  assert.ok(stats.businessMetrics.repartitionModes);
});

test("Control Hub — 4. Endpoint Recherche Utilisateurs (rechercherUtilisateurs)", async () => {
  // Recherche globale
  const resTous = await internalControlService.rechercherUtilisateurs({ limit: 10 });
  assert.ok(resTous.users.length > 0);
  assert.ok(resTous.pagination.total >= 1);

  const premier = resTous.users[0];
  assert.ok(premier.id);
  assert.ok(premier.email);
  assert.ok(premier.name);
  assert.ok(premier.role);
  assert.ok(premier.status === "actif" || premier.status === "suspendu");
  assert.ok(premier.study);

  // Recherche ciblée par email
  const resCible = await internalControlService.rechercherUtilisateurs({ search: premier.email });
  assert.ok(resCible.users.length >= 1);
  assert.equal(resCible.users[0].id, premier.id);
});

test("Control Hub — 5. Actions à distance (suspend, activate, reset_password)", async () => {
  const { rows } = await pool.query("SELECT id, email FROM utilisateurs LIMIT 1");
  assert.ok(rows.length > 0);
  const user = rows[0];

  // Action: suspend
  const resSuspend = await internalControlService.executerActionUtilisateur(user.id, "suspend");
  assert.equal(resSuspend.succes, true);
  assert.equal(resSuspend.status, "suspendu");

  // Action: activate
  const resActivate = await internalControlService.executerActionUtilisateur(user.id, "activate");
  assert.equal(resActivate.succes, true);
  assert.equal(resActivate.status, "actif");

  // Action: reset_password
  const resReset = await internalControlService.executerActionUtilisateur(user.id, "reset_password");
  assert.equal(resReset.succes, true);
  assert.ok(resReset.temporaryPassword);
  assert.ok(resReset.temporaryPassword.length >= 8);
});

test("Control Hub — 6. Impersonation & Magic Token 60s (genererTokenImpersonation)", async () => {
  const { rows } = await pool.query("SELECT id, email, role, nom_complet FROM utilisateurs LIMIT 1");
  const user = rows[0];

  const impersonation = await internalControlService.genererTokenImpersonation({ userId: user.id });
  assert.equal(impersonation.succes, true);
  assert.ok(impersonation.token);
  assert.equal(impersonation.user.id, user.id);
  assert.equal(impersonation.user.email, user.email);
  assert.equal(impersonation.expiresInSeconds, 60);
  assert.ok(impersonation.loginUrl.includes("impersonate_token="));

  // Vérification de la signature du JWT
  const decode = jwt.verify(impersonation.token, process.env.JWT_SECRET);
  assert.equal(decode.id, user.id);
  assert.equal(decode.impersonated, true);
  assert.equal(decode.impersonatedBy, "ControlHub-MasterAdmin");
});

test("Control Hub — 7. Dispatcher de Webhooks (notifyControlHub)", async () => {
  // Test de robustesse : quand le webhook est appelé, il ne doit jamais lever d'exception non interceptée
  const res = await notifyControlHub("test.ping", { message: "Test unitaire webhook" });
  assert.ok(typeof res === "object");
  assert.ok("succes" in res);
});
