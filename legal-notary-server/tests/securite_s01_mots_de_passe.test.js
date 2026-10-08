/**
 * tests/securite_s01_mots_de_passe.test.js
 *
 * Tests de vérification du correctif de sécurité S01 (Mots de passe universels).
 * Référence : Audit approfondi de sécurité (Section 3, S01) & Cahier des charges (Section 15 bis B).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const bcrypt = require("bcryptjs");

const { pool } = require("../src/db/pool");
const authService = require("../src/services/auth.service");
const authRoutes = require("../src/api/auth.routes");
const equipeRoutes = require("../src/api/equipe.routes");

function creerAppTest() {
  const app = express();
  app.use(express.json());

  // Middleware bouchon d'authentification pour tester les routes protégées d'équipe
  app.use((req, res, next) => {
    req.utilisateur = {
      id: "user-test-notaire",
      email: "notaire.test@etude.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    };
    next();
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/equipe", equipeRoutes);

  // Gestionnaire d'erreurs
  app.use((err, req, res, next) => {
    const status = err.status || (err.message && err.message.includes("obligatoire") ? 400 : 500);
    res.status(status).json({ erreur: err.message });
  });

  return app;
}

test("S01 — Connexion compte réel avec mot de passe X : 'notaire123' -> 401, 'admin123' -> 401, X -> 200", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const emailTest = `notaire.reel.${Date.now()}@etude.ci`;
  const motDePasseX = "MotDePasseUniqueComplexe2026!#";
  const hashX = await bcrypt.hash(motDePasseX, 10);

  // 1. Insertion d'un utilisateur réel en base de données avec son hash bcrypt
  await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, actif, etude_id)
     VALUES ($1, $2, $3, 'notaire', true, 'a0000000-0000-0000-0000-000000000001')
     ON CONFLICT (email) DO UPDATE SET mot_de_passe_hash = EXCLUDED.mot_de_passe_hash, actif = true`,
    ["Me Notaire Réel", emailTest, hashX]
  );

  try {
    // 2. Tentative avec 'notaire123' -> attendu 401
    const resNotaire123 = await fetch(`${baseUrl}/api/auth/connexion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailTest, motDePasse: "notaire123" }),
    });
    assert.equal(resNotaire123.status, 401, "La connexion avec 'notaire123' doit renvoyer 401");
    const jsonNotaire123 = await resNotaire123.json();
    assert.equal(jsonNotaire123.erreur, "Email ou mot de passe incorrect.");

    // Vérification unitaire directe au niveau du service
    const unitNotaire123 = await authService.connecter(emailTest, "notaire123");
    assert.equal(unitNotaire123, null, "authService.connecter doit renvoyer null pour 'notaire123'");

    // 3. Tentative avec 'admin123' -> attendu 401
    const resAdmin123 = await fetch(`${baseUrl}/api/auth/connexion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailTest, motDePasse: "admin123" }),
    });
    assert.equal(resAdmin123.status, 401, "La connexion avec 'admin123' doit renvoyer 401");
    const jsonAdmin123 = await resAdmin123.json();
    assert.equal(jsonAdmin123.erreur, "Email ou mot de passe incorrect.");

    // Vérification unitaire directe au niveau du service
    const unitAdmin123 = await authService.connecter(emailTest, "admin123");
    assert.equal(unitAdmin123, null, "authService.connecter doit renvoyer null pour 'admin123'");

    // 4. Tentative avec mot de passe réel X -> attendu 200 avec jeton
    const resX = await fetch(`${baseUrl}/api/auth/connexion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailTest, motDePasse: motDePasseX }),
    });
    assert.equal(resX.status, 200, "La connexion avec le mot de passe réel X doit renvoyer 200");
    const jsonX = await resX.json();
    assert.ok(jsonX.jeton, "Un jeton JWT valide doit être retourné");
    assert.equal(jsonX.utilisateur.email, emailTest);

    // Vérification unitaire directe au niveau du service
    const unitX = await authService.connecter(emailTest, motDePasseX);
    assert.ok(unitX && unitX.jeton, "authService.connecter doit renvoyer le jeton pour le mot de passe X");
  } finally {
    server.close();
    await pool.query("DELETE FROM utilisateurs WHERE email = $1", [emailTest]).catch(() => {});
  }
});

test("S01 — Compte avec hachage vide ou invalide : 401 sans plantage du serveur", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const emailHashInvalide = `invalide.${Date.now()}@etude.ci`;
  const emailHashVide = `vide.${Date.now()}@etude.ci`;

  // Compte avec hash corrompu non-bcrypt
  await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, actif, etude_id)
     VALUES ($1, $2, $3, 'clerc_redacteur', true, 'a0000000-0000-0000-0000-000000000001')`,
    ["Utilisateur Hash Invalide", emailHashInvalide, "hash_totalement_invalide_non_bcrypt"]
  );

  // Compte avec hash vide
  await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, actif, etude_id)
     VALUES ($1, $2, $3, 'clerc_redacteur', true, 'a0000000-0000-0000-0000-000000000001')`,
    ["Utilisateur Hash Vide", emailHashVide, ""]
  );

  try {
    // 1. Appel HTTP sur hash invalide -> doit répondre 401 sans planter (pas de 500)
    const resInvalide = await fetch(`${baseUrl}/api/auth/connexion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailHashInvalide, motDePasse: "Quelconque123!" }),
    });
    assert.equal(resInvalide.status, 401, "Un hash invalide doit répondre 401 sans crash");

    // Appel direct au service
    const unitInvalide = await authService.connecter(emailHashInvalide, "Quelconque123!");
    assert.equal(unitInvalide, null, "authService.connecter doit renvoyer null sans lever d'exception");

    // 2. Appel HTTP sur hash vide -> doit répondre 401 sans planter
    const resVide = await fetch(`${baseUrl}/api/auth/connexion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailHashVide, motDePasse: "Quelconque123!" }),
    });
    assert.equal(resVide.status, 401, "Un hash vide doit répondre 401 sans crash");

    // Appel direct au service
    const unitVide = await authService.connecter(emailHashVide, "Quelconque123!");
    assert.equal(unitVide, null, "authService.connecter doit renvoyer null pour un hash vide");
  } finally {
    server.close();
    await pool
      .query("DELETE FROM utilisateurs WHERE email IN ($1, $2)", [emailHashInvalide, emailHashVide])
      .catch(() => {});
  }
});

test("S01 — Création d'un compte sans mot de passe : refus immédiat avec code 400", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Appel HTTP POST /api/equipe sans motDePasse -> attendu 400
    const resHttp = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomComplet: "Nouveau Clerc Sans MDP",
        email: `sansmdp.${Date.now()}@etude.ci`,
        role: "clerc_redacteur",
      }),
    });
    assert.equal(resHttp.status, 400, "La création d'un utilisateur sans mot de passe via l'API doit renvoyer 400");
    const jsonHttp = await resHttp.json();
    assert.ok(jsonHttp.erreur.includes("Mot de passe obligatoire"));

    // 2. Appel direct à authService.creerUtilisateur sans mot de passe -> exception avec status 400
    await assert.rejects(
      async () => {
        await authService.creerUtilisateur({
          nomComplet: "Test Sans MDP Service",
          email: "sansmdp.direct@etude.ci",
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes("Mot de passe obligatoire"));
        return true;
      },
      "authService.creerUtilisateur doit lever une erreur 400 si aucun mot de passe n'est fourni"
    );
  } finally {
    server.close();
  }
});

test("S01 — Repli mémoire : rejet strict des mots de passe universels et comptes sans hash", async () => {
  // Les comptes COMPTES_DEMO_OFFLINE n'ayant plus de mdp en clair et aucun hash en mémoire,
  // la connexion hors ligne doit renvoyer null (aucune backdoor)
  const resDemoNotaire = await authService.connecter("notaire@notaire.ci", "notaire123");
  assert.equal(resDemoNotaire, null, "Le repli mémoire ne doit plus accepter 'notaire123'");

  const resDemoAdmin = await authService.connecter("admin@editeur-legal.ci", "admin123");
  assert.equal(resDemoAdmin, null, "Le repli mémoire ne doit plus accepter 'admin123'");
});

test("S01 — Absence totale de 'notaire123' et 'admin123' dans src/", () => {
  const repertoireSrc = path.resolve(__dirname, "../src");

  function inspecterDossier(dossier) {
    const entrees = fs.readdirSync(dossier, { withFileTypes: true });
    for (const entree of entrees) {
      const cheminComplet = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        inspecterDossier(cheminComplet);
      } else if (entree.isFile() && entree.name.endsWith(".js")) {
        const contenu = fs.readFileSync(cheminComplet, "utf8");
        assert.equal(contenu.includes("notaire123"), false, `Le fichier ${cheminComplet} contient encore 'notaire123'`);
        assert.equal(contenu.includes("admin123"), false, `Le fichier ${cheminComplet} contient encore 'admin123'`);
      }
    }
  }

  inspecterDossier(repertoireSrc);
});
