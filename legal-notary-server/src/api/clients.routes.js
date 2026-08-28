/**
 * src/api/clients.routes.js — Annuaire des clients (comparants), agrégés
 * depuis les dossiers visibles par l'utilisateur connecté. Voir
 * dossiers.service.js#listerClientsPourUtilisateur pour la portée RBAC
 * appliquée (identique à la liste des dossiers — pas de règle séparée à
 * maintenir ici).
 */

const express = require("express");
const dossiersService = require("../services/dossiers.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await dossiersService.listerClientsPourUtilisateur(req.utilisateur));
  } catch (e) { next(e); }
});

module.exports = router;
