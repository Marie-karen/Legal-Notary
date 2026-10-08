/**
 * tests/securite_s02_superadmin_role.test.js
 *
 * Tests de vérification du correctif de sécurité S02 (Contrôle strict des rôles SuperAdmin & Éditeur).
 * Référence : Audit approfondi de sécurité (Section 3, S02) & Cahier des charges (Section 3 bis, Exigence 2 & 15 bis B).
 *
 * Vérifie :
 * 1. Découverte dynamique de l'ensemble des routes des routeurs superadmin.routes.js, rapports.routes.js et telemetrie.routes.js.
 * 2. Rejet 403 systématique sur chaque route pour chacun des 7 rôles d'office notarial.
 * 3. Rejet 401 sur chaque routeur en cas d'absence de jeton d'authentification.
 * 4. Réponse 200/201 pour le rôle superadmin sur les routes de lecture.
 * 5. Journalisation structurée sans secret ni corps de requête sur chaque refus 403.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

const jwt = require("jsonwebtoken");
const { authentifier } = require("../src/middleware/authentifier");

const JWT_SECRET = process.env.JWT_SECRET || "16cbed43fe9ca83aa64e0d0dcc9adcba7a69eaabfe07f68acece208de51d3782";

function genererJeton(utilisateur) {
  return jwt.sign(
    {
      id: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
      etudeId: utilisateur.etudeId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

const superadminRoutes = require("../src/api/superadmin.routes");
const rapportsRoutes = require("../src/api/rapports.routes");
const telemetrieRoutes = require("../src/api/telemetrie.routes");
const { initTelemetrie } = require("../src/db/init-telemetrie");

test.before(async () => {
  await initTelemetrie();
});

const ROLES_ETUDE = [
  "notaire",
  "premier_clerc",
  "clerc_redacteur",
  "clerc_formaliste",
  "comptable_taxateur",
  "assistante",
  "archiviste",
];

/**
 * Extrait dynamiquement toutes les définitions de routes d'un routeur Express.
 */
function extraireRoutes(router) {
  const routes = [];
  for (const layer of router.stack) {
    if (layer.route) {
      const path = layer.route.path;
      for (const methode of Object.keys(layer.route.methods)) {
        routes.push({
          methode: methode.toUpperCase(),
          path,
        });
      }
    }
  }
  return routes;
}

/**
 * Initialise l'application Express de test avec la même chaîne de middleware que server.js.
 */
function creerAppTest() {
  const app = express();
  app.use(express.json());

  // 1. Télémétrie montée avant authentifier global pour ses endpoints edge
  app.use("/api/telemetrie", telemetrieRoutes);

  // 2. Middleware d'authentification obligatoire pour l'ensemble des API protégées
  app.use("/api", authentifier);

  // 3. Routeurs protégés montés après authentifier
  app.use("/api/superadmin", superadminRoutes);
  app.use("/api/rapports", rapportsRoutes);

  return app;
}

test("S02 — Découverte et intégrité des routes des 3 routeurs", () => {
  const routesSuperadmin = extraireRoutes(superadminRoutes);
  const routesRapports = extraireRoutes(rapportsRoutes);
  const routesTelemetrie = extraireRoutes(telemetrieRoutes);

  assert.equal(routesSuperadmin.length, 26, "superadmin.routes.js doit contenir 26 routes");
  assert.equal(routesRapports.length, 6, "rapports.routes.js doit contenir 6 routes");
  assert.equal(routesTelemetrie.length, 6, "telemetrie.routes.js doit contenir 6 routes");
});

test("S02 — superadmin.routes.js (26 routes) : refus 403 pour chacun des 7 rôles d'étude", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const routes = extraireRoutes(superadminRoutes);

    for (const r of routes) {
      // Résout les paramètres dynamiques comme :id ou :userId avec des valeurs fictives valides
      const urlPath = r.path.replace(/:[a-zA-Z0-9_]+/g, "a0000000-0000-0000-0000-000000000001");
      const targetUrl = `${baseUrl}/api/superadmin${urlPath}`;

      for (const role of ROLES_ETUDE) {
        const jeton = genererJeton({
          id: `usr-test-${role}`,
          email: `${role}@etude-test.ci`,
          role,
          etudeId: "a0000000-0000-0000-0000-000000000001",
        });

        const options = {
          method: r.methode,
          headers: {
            Authorization: `Bearer ${jeton}`,
            "Content-Type": "application/json",
          },
        };

        if (r.methode === "POST" || r.methode === "PUT") {
          options.body = JSON.stringify({ test: true });
        }

        const res = await fetch(targetUrl, options);
        assert.equal(
          res.status,
          403,
          `Route superadmin ${r.methode} ${r.path} doit refuser avec 403 pour le rôle ${role}`
        );

        const data = await res.json();
        assert.ok(data.erreur, `Le corps doit contenir une erreur explicite pour ${role} sur ${r.path}`);
      }
    }
  } finally {
    server.close();
  }
});

test("S02 — rapports.routes.js (6 routes) : refus 403 pour chacun des 7 rôles d'étude", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const routes = extraireRoutes(rapportsRoutes);

    for (const r of routes) {
      const urlPath = r.path.replace(/:[a-zA-Z0-9_]+/g, "commercial");
      const targetUrl = `${baseUrl}/api/rapports${urlPath}`;

      for (const role of ROLES_ETUDE) {
        const jeton = genererJeton({
          id: `usr-test-${role}`,
          email: `${role}@etude-test.ci`,
          role,
          etudeId: "a0000000-0000-0000-0000-000000000001",
        });

        const options = {
          method: r.methode,
          headers: {
            Authorization: `Bearer ${jeton}`,
            "Content-Type": "application/json",
          },
        };

        if (r.methode === "POST" || r.methode === "PUT") {
          options.body = JSON.stringify({ titre: "Rapport Test", test: true });
        }

        const res = await fetch(targetUrl, options);
        assert.equal(
          res.status,
          403,
          `Route rapports ${r.methode} ${r.path} doit refuser avec 403 pour le rôle ${role}`
        );

        const data = await res.json();
        assert.ok(data.erreur, `Le corps doit contenir une erreur explicite pour ${role} sur ${r.path}`);
      }
    }
  } finally {
    server.close();
  }
});

test("S02 — telemetrie.routes.js (routes de lecture) : refus 403 pour chacun des 7 rôles d'étude", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const routesLecture = [
      { methode: "GET", path: "/erreurs" },
      { methode: "GET", path: "/noeuds" },
      { methode: "PUT", path: "/erreurs/1/resoudre" },
      { methode: "POST", path: "/test-alerte" },
    ];

    for (const r of routesLecture) {
      const targetUrl = `${baseUrl}/api/telemetrie${r.path}`;

      for (const role of ROLES_ETUDE) {
        const jeton = genererJeton({
          id: `usr-test-${role}`,
          email: `${role}@etude-test.ci`,
          role,
          etudeId: "a0000000-0000-0000-0000-000000000001",
        });

        const options = {
          method: r.methode,
          headers: {
            Authorization: `Bearer ${jeton}`,
            "Content-Type": "application/json",
          },
        };

        const res = await fetch(targetUrl, options);
        assert.equal(
          res.status,
          403,
          `Route telemetrie ${r.methode} ${r.path} doit refuser avec 403 pour le rôle ${role}`
        );
      }
    }
  } finally {
    server.close();
  }
});

test("S02 — Requête sans jeton sur chaque routeur -> 401", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. superadmin sans jeton
    const resSuperadmin = await fetch(`${baseUrl}/api/superadmin/statistiques-globales`);
    assert.equal(resSuperadmin.status, 401, "GET /api/superadmin/statistiques-globales sans jeton doit renvoyer 401");

    // 2. rapports sans jeton
    const resRapports = await fetch(`${baseUrl}/api/rapports/parametres-frequences`);
    assert.equal(resRapports.status, 401, "GET /api/rapports/parametres-frequences sans jeton doit renvoyer 401");

    // 3. telemetrie (routes protégées) sans jeton
    const resTelemetrieNoeuds = await fetch(`${baseUrl}/api/telemetrie/noeuds`);
    assert.equal(resTelemetrieNoeuds.status, 401, "GET /api/telemetrie/noeuds sans jeton doit renvoyer 401");

    const resTelemetrieErreurs = await fetch(`${baseUrl}/api/telemetrie/erreurs`);
    assert.equal(resTelemetrieErreurs.status, 401, "GET /api/telemetrie/erreurs sans jeton doit renvoyer 401");
  } finally {
    server.close();
  }
});

test("S02 — Rôle superadmin autorisé (200) sur les routes de lecture", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const jetonSuperadmin = genererJeton({
      id: "usr-superadmin-master",
      email: "admin@editeur-legal.ci",
      role: "superadmin",
    });

    const headers = {
      Authorization: `Bearer ${jetonSuperadmin}`,
    };

    // 1. superadmin routes de lecture
    const resStats = await fetch(`${baseUrl}/api/superadmin/statistiques-globales`, { headers });
    assert.equal(resStats.status, 200, "GET /api/superadmin/statistiques-globales doit renvoyer 200 pour superadmin");

    const resEtudes = await fetch(`${baseUrl}/api/superadmin/etudes`, { headers });
    assert.equal(resEtudes.status, 200, "GET /api/superadmin/etudes doit renvoyer 200 pour superadmin");

    // 2. rapports routes de lecture
    const resRapportsParams = await fetch(`${baseUrl}/api/rapports/parametres-frequences`, { headers });
    assert.equal(
      resRapportsParams.status,
      200,
      "GET /api/rapports/parametres-frequences doit renvoyer 200 pour superadmin"
    );

    // 3. telemetrie routes de lecture
    const resNoeuds = await fetch(`${baseUrl}/api/telemetrie/noeuds`, { headers });
    assert.equal(resNoeuds.status, 200, "GET /api/telemetrie/noeuds doit renvoyer 200 pour superadmin");
  } finally {
    server.close();
  }
});

test("S02 — Journalisation structurée des refus 403 (sans secret, jeton ni corps)", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const logsCaptures = [];
  const originalWarn = console.warn;
  console.warn = (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.evenement === "ACCES_REFUSE_ROLE") {
        logsCaptures.push(parsed);
      }
    } catch {
      // Ignorer les messages non-JSON
    }
  };

  try {
    const jetonNotaire = genererJeton({
      id: "usr-notaire-403",
      email: "notaire@office.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    const res = await fetch(`${baseUrl}/api/superadmin/statistiques-globales`, {
      headers: { Authorization: `Bearer ${jetonNotaire}` },
    });
    assert.equal(res.status, 403);

    assert.equal(logsCaptures.length, 1, "Un log structuré de refus 403 doit avoir été émis");
    const log = logsCaptures[0];
    assert.equal(log.evenement, "ACCES_REFUSE_ROLE");
    assert.equal(log.statut, 403);
    assert.equal(log.utilisateurId, "usr-notaire-403");
    assert.equal(log.role, "notaire");
    assert.equal(log.methode, "GET");
    assert.ok(log.route.includes("/statistiques-globales"));
    assert.ok(log.dateHeure);

    // Vérification de l'absence totale de données sensibles
    const logStr = JSON.stringify(log);
    assert.ok(!logStr.includes(jetonNotaire), "Le journal ne doit jamais contenir de jeton JWT");
    assert.ok(!logStr.includes("motDePasse"), "Le journal ne doit contenir aucun mot de passe");
    assert.ok(!logStr.includes("Authorization"), "Le journal ne doit contenir aucun en-tête d'autorisation");
  } finally {
    console.warn = originalWarn;
    server.close();
  }
});
