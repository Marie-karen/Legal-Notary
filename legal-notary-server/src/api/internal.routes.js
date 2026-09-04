/**
 * src/api/internal.routes.js
 *
 * Routes de l'API d'Administration Interne (/api/internal/*).
 * Exclusivement réservées au SaaS de Contrôle Centralisé (Master Super Admin Hub).
 * Protégées par le middleware `exigerCleControlHub`.
 */

const express = require("express");
const { exigerCleControlHub } = require("../middleware/controlHubAuth.middleware");
const internalControlService = require("../services/internal-control.service");

const router = express.Router();

// Application du middleware de sécurité sur TOUTES les routes de ce routeur
router.use(exigerCleControlHub);

/**
 * 1. GET /api/internal/health
 * État de santé, ping base de données, métriques système.
 */
router.get("/health", async (req, res, next) => {
  try {
    const sante = await internalControlService.obtenirHealth();
    res.json(sante);
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/internal/stats
 * Statistiques globales du SaaS (utilisateurs, MRR estimé, volumétrie, répartition).
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await internalControlService.obtenirStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * 3. GET /api/internal/users
 * Recherche et pagination des utilisateurs du SaaS (query: search, limit, page, status).
 */
router.get("/users", async (req, res, next) => {
  try {
    const { search, limit, page, status } = req.query;
    const resultat = await internalControlService.rechercherUtilisateurs({
      search,
      limit,
      page,
      status,
    });
    res.json(resultat);
  } catch (err) {
    next(err);
  }
});

/**
 * 4. POST /api/internal/users/:id/action
 * Exécution d'actions à distance sur un utilisateur (suspend, activate, change_role, reset_password, upgrade_plan).
 */
router.post("/users/:id/action", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, ...payload } = req.body || {};

    if (!action) {
      return res.status(400).json({ erreur: "Le paramètre 'action' est obligatoire dans le corps de la requête." });
    }

    const resultat = await internalControlService.executerActionUtilisateur(id, action, payload);
    res.json(resultat);
  } catch (err) {
    next(err);
  }
});

/**
 * 5. POST /api/internal/auth/impersonate
 * Génère un jeton magique court terme (60s) permettant au Super Admin de se connecter en 1 clic sur le compte client pour le support.
 */
router.post("/auth/impersonate", async (req, res, next) => {
  try {
    const { userId, email } = req.body || {};

    if (!userId && !email) {
      return res.status(400).json({ erreur: "Veuillez fournir 'userId' ou 'email' pour l'impersonation." });
    }

    const resultat = await internalControlService.genererTokenImpersonation({ userId, email });
    res.json(resultat);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
