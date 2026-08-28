/**
 * src/api/manuel-procedure.routes.js — Manuel de procédure (qui fait quoi,
 * niveau d'alerte par étape). Lecture ouverte à tous les rôles connectés
 * (c'est un document de référence pour toute l'équipe) ; modification
 * réservée à `referentiel:gerer` (notaire, premier clerc).
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const manuelProcedureService = require("../services/manuel-procedure.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await manuelProcedureService.listerEtapes());
  } catch (e) { next(e); }
});

router.patch("/:id", exigerPermission("referentiel:gerer"), async (req, res, next) => {
  try {
    const etape = await manuelProcedureService.modifierEtape(req.params.id, req.body);
    if (!etape) return res.status(404).json({ erreur: "Étape introuvable." });
    res.json(etape);
  } catch (e) { next(e); }
});

module.exports = router;
