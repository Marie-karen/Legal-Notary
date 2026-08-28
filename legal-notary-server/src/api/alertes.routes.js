/**
 * src/api/alertes.routes.js — Centre d'alertes proactives.
 *
 * Pas de permission dédiée : chaque rôle a le droit de voir SES alertes
 * (dossiers.service.js filtre déjà par portée RBAC en amont, voir
 * alertes.service.js).
 */

const express = require("express");
const alertesService = require("../services/alertes.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await alertesService.calculerAlertesPourUtilisateur(req.utilisateur));
  } catch (e) { next(e); }
});

module.exports = router;
