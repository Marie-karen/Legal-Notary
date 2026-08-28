/**
 * src/api/notifications.routes.js — Fil in-app et abonnement push.
 *
 * Pas de permission dédiée : chaque utilisateur connecté gère SES propres
 * notifications et SON propre abonnement push, jamais ceux d'un autre —
 * la portée est déjà l'utilisateur connecté (req.utilisateur.id), pas un
 * paramètre d'URL modifiable.
 */

const express = require("express");
const notificationsService = require("../services/notifications.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const nonLuesSeulement = req.query.nonLues === "true";
    res.json(await notificationsService.listerNotificationsUtilisateur(req.utilisateur.id, { nonLuesSeulement }));
  } catch (e) { next(e); }
});

router.post("/:id/lue", async (req, res, next) => {
  try {
    await notificationsService.marquerLue(req.params.id, req.utilisateur.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Enregistre l'abonnement Web Push du navigateur/appareil courant (le
// frontend appelle ceci après que l'utilisateur a autorisé les
// notifications — mécanisme standard du navigateur, comme les
// notifications système de n'importe quelle app web).
router.post("/push/abonnement", async (req, res, next) => {
  try {
    await notificationsService.enregistrerAbonnementPush(req.utilisateur.id, req.body);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
