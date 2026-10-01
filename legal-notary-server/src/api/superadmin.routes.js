/**
 * src/api/superadmin.routes.js — Routes de la Console Super Admin SaaS.
 */

const express = require("express");
const router = express.Router();
const superadminService = require("../services/superadmin.service");
const monitoringSupportService = require("../services/monitoring-support.service");

// 1. Statistiques globales SaaS
router.get("/statistiques-globales", async (req, res, next) => {
  try {
    const stats = await superadminService.obtenirStatistiquesGlobales();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

// 2. Liste des études notariales du parc
router.get("/etudes", async (req, res, next) => {
  try {
    const etudes = await superadminService.listerEtudes();
    res.json(etudes);
  } catch (e) {
    next(e);
  }
});

// 3. Déploiement d'une nouvelle étude
router.post("/etudes", async (req, res, next) => {
  try {
    const nouvelle = await superadminService.creerEtude(req.body);
    res.status(201).json(nouvelle);
  } catch (e) {
    next(e);
  }
});

// 4. Modification de la configuration complète d'une étude
router.put("/etudes/:id", async (req, res, next) => {
  try {
    const maj = await superadminService.mettreAJourEtude(req.params.id, req.body);
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

// 4b. Suppression définitive / Résiliation d'une étude
router.delete("/etudes/:id", async (req, res, next) => {
  try {
    const resultat = await superadminService.supprimerEtude(req.params.id);
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// 4b-bis. Suppression en lot / multi-sélection d'études
router.post("/etudes/supprimer-lot", async (req, res, next) => {
  try {
    const ids = req.body.ids || [];
    const resultat = await superadminService.supprimerPlusieursEtudes(ids);
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// 4c. Liste des utilisateurs / collaborateurs d'une étude
router.get("/etudes/:id/utilisateurs", async (req, res, next) => {
  try {
    const utilisateurs = await superadminService.listerUtilisateursEtude(req.params.id);
    res.json(utilisateurs);
  } catch (e) {
    next(e);
  }
});

// 4d. Ajout d'un collaborateur à une étude depuis le SuperAdmin
router.post("/etudes/:id/utilisateurs", async (req, res, next) => {
  try {
    const nouveau = await superadminService.ajouterCollaborateurEtude(req.params.id, req.body);
    res.status(201).json(nouveau);
  } catch (e) {
    next(e);
  }
});

// 4e. Réinitialisation du mot de passe d'un utilisateur d'une étude
router.post("/etudes/:id/utilisateurs/:userId/reinitialiser-mdp", async (req, res, next) => {
  try {
    const resultat = await superadminService.reinitialiserMotDePasseEtude(req.params.id, req.params.userId, req.body.motDePasse);
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// 5. Changement rapide de mode infrastructure d'une étude
router.post("/etudes/:id/basculer-mode", async (req, res, next) => {
  try {
    const maj = await superadminService.changerModeInfrastructure(req.params.id, req.body.modeInfrastructure);
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

// 5b. Informations techniques & guide de déploiement d'une étude (Cloud, Domaine, Serveur physique, Hybride)
router.get("/etudes/:id/deploiement", async (req, res, next) => {
  try {
    const infos = await superadminService.obtenirInfosDeploiementEtude(req.params.id);
    res.json(infos);
  } catch (e) {
    next(e);
  }
});

// 5c. Gestion de l'Équipe Interne Éditeur SaaS (Devs, Commerciaux, Support L1-L4, Assistante)
router.get("/equipe", async (req, res, next) => {
  try {
    const equipe = await superadminService.listerEquipeEditeur();
    res.json(equipe);
  } catch (e) {
    next(e);
  }
});

router.post("/equipe", async (req, res, next) => {
  try {
    const nouveau = await superadminService.ajouterMembreEditeur(req.body);
    res.status(201).json(nouveau);
  } catch (e) {
    next(e);
  }
});

router.put("/equipe/:id", async (req, res, next) => {
  try {
    const maj = await superadminService.modifierMembreEditeur(req.params.id, req.body);
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

router.delete("/equipe/:id", async (req, res, next) => {
  try {
    const sup = await superadminService.supprimerMembreEditeur(req.params.id);
    res.json(sup);
  } catch (e) {
    next(e);
  }
});

// 5d. Matrice interactive des permissions et rôles internes éditeur
router.get("/permissions-matrice", async (req, res, next) => {
  try {
    const matrice = await superadminService.obtenirMatricePermissions();
    res.json(matrice);
  } catch (e) {
    next(e);
  }
});

router.put("/permissions-matrice", async (req, res, next) => {
  try {
    const maj = await superadminService.sauvegarderMatricePermissions(req.body);
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

router.post("/permissions-matrice/reinitialiser", async (req, res, next) => {
  try {
    const init = await superadminService.reinitialiserMatricePermissions();
    res.json(init);
  } catch (e) {
    next(e);
  }
});

// 6. Liste consolidée des tickets support du parc
router.get("/tickets-support", async (req, res, next) => {
  try {
    const tickets = await monitoringSupportService.listerTickets();
    res.json(tickets);
  } catch (e) {
    next(e);
  }
});

// 6. État de l'infrastructure globale SaaS & Topologie des clusters
router.get("/infrastructure", async (req, res, next) => {
  try {
    const infra = await superadminService.obtenirEtatInfrastructure();
    res.json(infra);
  } catch (e) {
    next(e);
  }
});

// 7. Liste des sauvegardes, snapshots immuables et rétention
router.get("/sauvegardes", async (req, res, next) => {
  try {
    const sauvegardes = await superadminService.listerSauvegardesEtSnapshots();
    res.json(sauvegardes);
  } catch (e) {
    next(e);
  }
});

// 8. Déclenchement d'un snapshot global d'urgence
router.post("/sauvegardes/snapshot-urgence", async (req, res, next) => {
  try {
    const resultat = await superadminService.declencherSnapshotUrgence();
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// 9. Simulation & Test du Plan de Reprise d'Activité (PRA)
router.post("/sauvegardes/test-pra", async (req, res, next) => {
  try {
    const test = await superadminService.testerPlanReprise();
    res.json(test);
  } catch (e) {
    next(e);
  }
});

// 11. Journal des emails envoyés & notification de bienvenue
router.get("/emails-envoyes", async (req, res, next) => {
  try {
    const limite = Number(req.query.limite) || 50;
    const emails = superadminService.listerEmailsEnvoyes(limite);
    res.json(emails);
  } catch (e) {
    next(e);
  }
});

// 12. Renvoyer manuellement un email d'identifiants
router.post("/renvoyer-email", async (req, res, next) => {
  try {
    const { email, nomComplet, role, motDePasse, nomEtude, domaine } = req.body || {};
    const resultat = await superadminService.envoyerEmailBienvenueCollaborateur({
      destinataireEmail: email,
      nomComplet,
      role,
      motDePasse,
      nomEtude,
      domaine,
    });
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// 13. Tester la configuration SMTP en direct
router.post("/tester-smtp", async (req, res, next) => {
  try {
    const { emailTest } = req.body || {};
    const dest = emailTest || (req.utilisateur && req.utilisateur.email) || "contact@legalnotary.app";
    const resultat = await superadminService.envoyerEmailBienvenueCollaborateur({
      destinataireEmail: dest,
      nomComplet: "Administrateur Test",
      role: "superadmin",
      motDePasse: "TestPass123!",
      nomEtude: "Legal Notary — Test SMTP",
      domaine: "legalnotary.app",
    });
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
