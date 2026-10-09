/**
 * tests/securite_s03_equipe_roles.test.js
 *
 * Tests de vérification du correctif de sécurité S03 (Escalade de rôle et écrasement de comptes).
 * Référence : Audit approfondi de sécurité (Section 3, S03) & Cahier des charges (Section 3 bis, Exigence 5).
 *
 * Vérifie :
 * 1. Création sans rôle -> 400 "Rôle obligatoire".
 * 2. Création avec rôle non autorisé en étude (ex: "superadmin") -> 400.
 * 3. Tentative de création d'un notaire ou premier_clerc par un premier_clerc -> 403.
 * 4. Tentative de création avec un email déjà existant dans une autre étude -> 409 et compte d'origine intact.
 * 5. Modification (PATCH) d'un utilisateur d'une autre étude -> 404.
 * 6. Désactivation (DELETE) d'un utilisateur d'une autre étude -> 404.
 * 7. Tentative par un utilisateur de modifier son propre rôle -> 403.
 * 8. PATCH avec injection de etude_id d'une autre étude -> ignoré (etude_id d'origine intact).
 * 9. Tentative de rétrograder le DERNIER notaire actif de l'étude -> 403.
 * 10. Tentative de désactiver le DERNIER notaire actif de l'étude -> 403.
 * 11. Non-régression console : creerEtude et ajouterCollaborateurEtude fonctionnent toujours.
 * 12. Traçabilité dans journal_audit : consignation de création, changement de rôle et désactivation (qui, quoi, quand).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { pool } = require("../src/db/pool");
const { authentifier } = require("../src/middleware/authentifier");
const equipeRoutes = require("../src/api/equipe.routes");
const superadminService = require("../src/services/superadmin.service");
const authService = require("../src/services/auth.service");
const auditService = require("../src/services/audit.service");

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

function creerAppTest() {
  const app = express();
  app.use(express.json());
  app.use("/api", authentifier);
  app.use("/api/equipe", equipeRoutes);
  return app;
}

test("S03 — 1. Rôle obligatoire : refus 400 si rôle manquant lors de la création", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const jetonNotaire = genererJeton({
      id: "usr-notaire-s03-1",
      email: "notaire1@etude-a.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    const res = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonNotaire}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Test Sans Rôle",
        email: `sans.role.${Date.now()}@etude-a.ci`,
        motDePasse: "ComplexPass123!#",
      }),
    });

    assert.equal(res.status, 400, "Création sans rôle doit renvoyer 400");
    const data = await res.json();
    assert.match(data.erreur, /rôle obligatoire/i);
  } finally {
    server.close();
  }
});

test("S03 — 2. Rôle 'superadmin' interdit pour une étude : refus 400", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const jetonNotaire = genererJeton({
      id: "usr-notaire-s03-2",
      email: "notaire2@etude-a.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    const res = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonNotaire}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Attaque Superadmin",
        email: `hacker.${Date.now()}@etude-a.ci`,
        motDePasse: "ComplexPass123!#",
        role: "superadmin",
      }),
    });

    assert.equal(res.status, 400, "Attribution du rôle superadmin en étude doit être rejetée avec 400");
    const data = await res.json();
    assert.match(data.erreur, /rôle non valide|rôle invalide/i);
  } finally {
    server.close();
  }
});

test("S03 — 3. Hiérarchie : un premier clerc ne peut pas créer un notaire ni un premier clerc (403)", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const jetonPremierClerc = genererJeton({
      id: "usr-premier-clerc-s03",
      email: "premier.clerc@etude-a.ci",
      role: "premier_clerc",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    // 1. Tente de créer un notaire -> 403
    const resCreerNotaire = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonPremierClerc}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Nouveau Notaire Illégitime",
        email: `faux.notaire.${Date.now()}@etude-a.ci`,
        motDePasse: "ComplexPass123!#",
        role: "notaire",
      }),
    });
    assert.equal(resCreerNotaire.status, 403, "Un premier clerc ne doit pas pouvoir créer un notaire");

    // 2. Tente de créer un premier clerc -> 403
    const resCreerPremierClerc = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonPremierClerc}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Nouveau Premier Clerc Illégitime",
        email: `faux.principal.${Date.now()}@etude-a.ci`,
        motDePasse: "ComplexPass123!#",
        role: "premier_clerc",
      }),
    });
    assert.equal(resCreerPremierClerc.status, 403, "Un premier clerc ne doit pas pouvoir créer un premier clerc");
  } finally {
    server.close();
  }
});

test("S03 — 4. Écrasement d'email refusé (409) : compte d'origine d'une autre étude 100% intact", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const emailVictime = `victime.etude.b.${Date.now()}@etude-b.ci`;
  const mdpVictime = "MotDePasseLegitimeEtudeB123!#";
  const hashVictime = await bcrypt.hash(mdpVictime, 10);
  const etudeB = "b0000000-0000-0000-0000-000000000002";

  // Création d'une étude B si elle n'existe pas
  await pool.query(
    `INSERT INTO etudes (id, nom_etude, code_etude)
     VALUES ($1, 'Étude B Test', 'ETD-B-TEST')
     ON CONFLICT (id) DO NOTHING`,
    [etudeB]
  );

  // Insertion de la victime dans l'étude B
  const { rows: rowsVictime } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, etude_id)
     VALUES ('Me Victime B', $1, $2, 'notaire', $3)
     RETURNING *`,
    [emailVictime, hashVictime, etudeB]
  );
  const idVictime = rowsVictime[0].id;

  try {
    // Un notaire de l'étude A tente de créer un utilisateur avec le même email
    const jetonNotaireA = genererJeton({
      id: "usr-notaire-etude-a",
      email: "notaire@etude-a.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    const res = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonNotaireA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Usurpateur A",
        email: emailVictime,
        motDePasse: "PiratePassword999!#",
        role: "clerc_redacteur",
      }),
    });

    assert.equal(res.status, 409, "La tentative d'écraser un email existant doit renvoyer 409 Conflict");

    // Vérification stricte en base : le compte d'origine n'a pas bougé
    const { rows: checkVictime } = await pool.query("SELECT * FROM utilisateurs WHERE id = $1", [idVictime]);
    assert.equal(checkVictime.length, 1);
    const v = checkVictime[0];
    assert.equal(v.email, emailVictime);
    assert.equal(v.nom_complet, "Me Victime B");
    assert.equal(v.role, "notaire");
    assert.equal(v.etude_id, etudeB);
    assert.equal(v.mot_de_passe_hash, hashVictime, "Le mot de passe de la victime ne doit pas avoir changé");
  } finally {
    server.close();
  }
});

test("S03 — 5 & 6. Isolation d'étude : modification ou désactivation d'un utilisateur d'une autre étude -> 404", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const etudeB = "b0000000-0000-0000-0000-000000000002";
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, etude_id, actif)
     VALUES ('Clerc Étude B', $1, 'hash_fake', 'clerc_redacteur', $2, true)
     RETURNING *`,
    [`clerc.b.${Date.now()}@etude-b.ci`, etudeB]
  );
  const idCibleB = rows[0].id;

  try {
    const jetonNotaireA = genererJeton({
      id: "usr-notaire-a",
      email: "notaire@etude-a.ci",
      role: "notaire",
      etudeId: "a0000000-0000-0000-0000-000000000001",
    });

    // 1. PATCH sur un collaborateur d'une autre étude -> 404
    const resPatch = await fetch(`${baseUrl}/api/equipe/${idCibleB}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jetonNotaireA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telephone: "+225 07 99 99 99" }),
    });
    assert.equal(resPatch.status, 404, "PATCH sur utilisateur d'une autre étude doit renvoyer 404");

    // 2. DELETE sur un collaborateur d'une autre étude -> 404
    const resDelete = await fetch(`${baseUrl}/api/equipe/${idCibleB}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jetonNotaireA}`,
      },
    });
    assert.equal(resDelete.status, 404, "DELETE sur utilisateur d'une autre étude doit renvoyer 404");

    // Vérifier que la cible est toujours active
    const { rows: checkActif } = await pool.query("SELECT actif FROM utilisateurs WHERE id = $1", [idCibleB]);
    assert.equal(checkActif[0].actif, true);
  } finally {
    server.close();
  }
});

test("S03 — 7 & 8. Personne ne modifie son propre rôle (403) et injection etude_id inopérante", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const etudeA = "a0000000-0000-0000-0000-000000000001";
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, etude_id, actif)
     VALUES ('Premier Clerc Test', $1, 'hash_fake', 'premier_clerc', $2, true)
     RETURNING *`,
    [`principal.${Date.now()}@etude-a.ci`, etudeA]
  );
  const idPremierClerc = rows[0].id;

  try {
    const jetonPremierClerc = genererJeton({
      id: idPremierClerc,
      email: rows[0].email,
      role: "premier_clerc",
      etudeId: etudeA,
    });

    // 1. Tente de modifier son propre rôle -> 403
    const resAutoRole = await fetch(`${baseUrl}/api/equipe/${idPremierClerc}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jetonPremierClerc}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "notaire" }),
    });
    assert.equal(resAutoRole.status, 403, "Une personne ne peut pas modifier son propre rôle");

    // 2. Tente d'injecter etude_id d'une autre étude
    const resInjectEtude = await fetch(`${baseUrl}/api/equipe/${idPremierClerc}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jetonPremierClerc}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Premier Clerc Renommé",
        etude_id: "b0000000-0000-0000-0000-000000000002",
        etudeId: "b0000000-0000-0000-0000-000000000002",
      }),
    });
    assert.equal(resInjectEtude.status, 200);

    // Vérifier en base que etude_id n'a pas bougé
    const { rows: checkEtude } = await pool.query("SELECT etude_id, nom_complet FROM utilisateurs WHERE id = $1", [
      idPremierClerc,
    ]);
    assert.equal(checkEtude[0].etude_id, etudeA, "etude_id ne doit pas avoir changé");
    assert.equal(checkEtude[0].nom_complet, "Premier Clerc Renommé");
  } finally {
    server.close();
  }
});

test("S03 — 9 & 10. Interdiction de rétrograder ou désactiver le DERNIER notaire actif (403)", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const etudeUnique = crypto.randomUUID();
  await pool.query(
    `INSERT INTO etudes (id, nom_etude, code_etude)
     VALUES ($1, 'Étude Notaire Unique', $2)`,
    [etudeUnique, `ETD-C-${Date.now()}`]
  );

  // Création du seul et unique notaire de l'étude C
  const { rows: rowsNotaire } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, etude_id, actif)
     VALUES ('Me Seul Notaire', $1, 'hash_fake', 'notaire', $2, true)
     RETURNING *`,
    [`seul.notaire.${Date.now()}@etude-c.ci`, etudeUnique]
  );
  const idNotaire = rowsNotaire[0].id;

  // Création d'un second utilisateur habilité (notaire associé temporaire pour agir sur le compte)
  const { rows: rowsNotaire2 } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, etude_id, actif)
     VALUES ('Me Notaire Associé', $1, 'hash_fake', 'notaire', $2, true)
     RETURNING *`,
    [`associe.${Date.now()}@etude-c.ci`, etudeUnique]
  );
  const idNotaire2 = rowsNotaire2[0].id;

  try {
    const jetonNotaire2 = genererJeton({
      id: idNotaire2,
      email: rowsNotaire2[0].email,
      role: "notaire",
      etudeId: etudeUnique,
    });

    // On désactive d'abord le notaire 2 pour que le notaire 1 devienne le DERNIER notaire actif
    await pool.query("UPDATE utilisateurs SET actif = false WHERE id = $1", [idNotaire2]);

    // 1. Tente de rétrograder le dernier notaire en clerc -> 403
    const resRetrograder = await fetch(`${baseUrl}/api/equipe/${idNotaire}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jetonNotaire2}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "clerc_redacteur" }),
    });
    assert.equal(resRetrograder.status, 403, "Rétrograder le dernier notaire actif doit être refusé avec 403");
    const dataRetro = await resRetrograder.json();
    assert.match(dataRetro.erreur, /dernier notaire actif/i);

    // 2. Tente de désactiver le dernier notaire actif -> 403
    const resDesactiver = await fetch(`${baseUrl}/api/equipe/${idNotaire}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jetonNotaire2}`,
      },
    });
    assert.equal(resDesactiver.status, 403, "Désactiver le dernier notaire actif doit être refusé avec 403");
    const dataDesact = await resDesactiver.json();
    assert.match(dataDesact.erreur, /dernier notaire actif/i);
  } finally {
    server.close();
  }
});

test("S03 — 11. Non-régression Console : creerEtude et ajouterCollaborateurEtude fonctionnent toujours", async () => {
  const codeUnique = "ETD-REG-" + Date.now();
  const etudeCreee = await superadminService.creerEtude({
    nomEtude: "Office Notarial Non Régression",
    titreNotaire: "Me Non Régression",
    emailNotaire: `notaire.nr.${Date.now()}@etude.ci`,
    motDePasse: "SuperPassword123!#",
    ville: "Abidjan",
    domaine: `nr-${Date.now()}.legalnotary.app`,
    codeEtude: codeUnique,
    envoyerEmails: false,
  });

  assert.ok(etudeCreee.id, "L'étude doit être créée avec succès");

  // 1. Tentative sans rôle -> 400 "Rôle obligatoire"
  await assert.rejects(
    async () => {
      await superadminService.ajouterCollaborateurEtude(etudeCreee.id, {
        nomComplet: "Clerc Sans Rôle",
        email: `sans.role.console.${Date.now()}@etude.ci`,
        motDePasse: "ClercPassword123!#",
      });
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /rôle obligatoire/i);
      return true;
    }
  );

  // 2. Tentative avec rôle invalide -> 400 "Rôle invalide pour un collaborateur d'étude."
  await assert.rejects(
    async () => {
      await superadminService.ajouterCollaborateurEtude(etudeCreee.id, {
        nomComplet: "Clerc Superadmin",
        email: `hacker.console.${Date.now()}@etude.ci`,
        motDePasse: "ClercPassword123!#",
        role: "superadmin",
      });
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /rôle invalide/i);
      return true;
    }
  );

  // 3. Ajout légitime avec rôle valide
  const collaborateur = await superadminService.ajouterCollaborateurEtude(etudeCreee.id, {
    nomComplet: "Clerc Déployé Console",
    email: `clerc.console.${Date.now()}@etude.ci`,
    motDePasse: "ClercPassword123!#",
    role: "clerc_redacteur",
    telephone: "+225 07 11 22 33",
  });

  assert.ok(collaborateur.id, "Le collaborateur doit être ajouté avec succès par la console");
  assert.equal(collaborateur.role, "clerc_redacteur");
});

test("S03 — 12. Traçabilité complète dans journal_audit (qui, quoi, quand)", async () => {
  const app = creerAppTest();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const etudeId = crypto.randomUUID();
  const notaireId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO etudes (id, nom_etude, code_etude)
     VALUES ($1, 'Étude Audit Test', $2)`,
    [etudeId, `ETD-AUD-${Date.now()}`]
  );
  await pool.query(
    `INSERT INTO utilisateurs (id, nom_complet, email, mot_de_passe_hash, role, etude_id, actif)
     VALUES ($1, 'Me Notaire Audit', $2, 'hash_fake', 'notaire', $3, true)`,
    [notaireId, `notaire.audit.${Date.now()}@etude-a.ci`, etudeId]
  );

  const jetonNotaire = genererJeton({
    id: notaireId,
    email: `notaire.audit.${Date.now()}@etude-a.ci`,
    role: "notaire",
    etudeId,
  });

  try {
    // 1. Création
    const emailTest = `audit.user.${Date.now()}@etude-a.ci`;
    const resCreate = await fetch(`${baseUrl}/api/equipe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jetonNotaire}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomComplet: "Collaborateur Audit",
        email: emailTest,
        motDePasse: "ComplexPass123!#",
        role: "assistante",
      }),
    });
    assert.equal(resCreate.status, 201);
    const userCree = await resCreate.json();

    // 2. Changement de rôle
    const resPatchRole = await fetch(`${baseUrl}/api/equipe/${userCree.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jetonNotaire}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "archiviste" }),
    });
    assert.equal(resPatchRole.status, 200);

    // 3. Désactivation
    const resDelete = await fetch(`${baseUrl}/api/equipe/${userCree.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jetonNotaire}`,
      },
    });
    assert.equal(resDelete.status, 204);

    // Vérification des entrées dans journal_audit
    const { rows: audits } = await pool.query(
      "SELECT * FROM journal_audit WHERE ligne_id = $1 ORDER BY created_at ASC",
      [userCree.id]
    );

    assert.ok(
      audits.length >= 3,
      "Le journal d'audit doit consigner au moins création, changement de rôle et désactivation"
    );

    const auditCreation = audits.find((a) => a.action === "creation");
    assert.ok(auditCreation);
    assert.equal(auditCreation.utilisateur_id, notaireId);

    const auditRole = audits.find((a) => a.action === "changement_role");
    assert.ok(auditRole);
    assert.equal(auditRole.utilisateur_id, notaireId);

    const auditDesact = audits.find((a) => a.action === "desactivation");
    assert.ok(auditDesact);
    assert.equal(auditDesact.utilisateur_id, notaireId);
  } finally {
    server.close();
  }
});

test("S03 — 13. Audit fail-secure : refus formel d'enregistrer un événement sans identifiant auteur ou cible valide", async () => {
  const validUuid = crypto.randomUUID();

  // Auteur invalide (non UUID ou vide) -> échec immédiat
  await assert.rejects(
    async () => {
      await auditService.consigner("utilisateurs", validUuid, "creation", "auteur-non-uuid", {});
    },
    (err) => {
      assert.equal(err.code, "AUDIT_AUTEUR_INVALIDE");
      return true;
    }
  );

  // Cible invalide (non UUID ou vide) -> échec immédiat
  await assert.rejects(
    async () => {
      await auditService.consigner("utilisateurs", "cible-non-uuid", "creation", validUuid, {});
    },
    (err) => {
      assert.equal(err.code, "AUDIT_CIBLE_INVALIDE");
      return true;
    }
  );
});
