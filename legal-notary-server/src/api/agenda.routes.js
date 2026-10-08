/**
 * src/api/agenda.routes.js — Routes d'API pour l'Agenda Notarial & la To-Do List.
 */

const express = require("express");
const agendaService = require("../services/agenda.service");

const router = express.Router();

// =========================================================================
// ÉVÉNEMENTS & RENDEZ-VOUS
// =========================================================================

// GET /api/agenda/evenements
router.get("/evenements", async (req, res, next) => {
  try {
    const filtres = {
      notaireId: req.query.notaireId,
      debut: req.query.debut,
      fin: req.query.fin,
    };
    const evenements = await agendaService.listerEvenements(filtres, req.utilisateur || {});
    res.json(evenements);
  } catch (e) {
    next(e);
  }
});

// POST /api/agenda/evenements
router.post("/evenements", async (req, res, next) => {
  try {
    const nouveau = await agendaService.creerEvenement(req.body, req.utilisateur || {});
    res.status(201).json(nouveau);
  } catch (e) {
    next(e);
  }
});

// GET /api/agenda/prerequis-signature/:dossierId
router.get("/prerequis-signature/:dossierId", async (req, res, next) => {
  try {
    const verif = await agendaService.verifierPrerequisSignature(req.params.dossierId, req.utilisateur || {});
    res.json(verif);
  } catch (e) {
    next(e);
  }
});

// PUT /api/agenda/evenements/:id
router.put("/evenements/:id", async (req, res, next) => {
  try {
    const maj = await agendaService.mettreAJourEvenement(req.params.id, req.body, req.utilisateur || {});
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/agenda/evenements/:id
router.delete("/evenements/:id", async (req, res, next) => {
  try {
    const resu = await agendaService.supprimerEvenement(req.params.id);
    res.json(resu);
  } catch (e) {
    next(e);
  }
});

// =========================================================================
// TO-DO LIST & TÂCHES COLLABORATEURS
// =========================================================================

// GET /api/agenda/taches
router.get("/taches", async (req, res, next) => {
  try {
    const filtres = {
      assigneAId: req.query.assigneAId,
      dossierId: req.query.dossierId,
      statut: req.query.statut,
    };
    const taches = await agendaService.listerTaches(filtres, req.utilisateur || {});
    res.json(taches);
  } catch (e) {
    next(e);
  }
});

// POST /api/agenda/taches
router.post("/taches", async (req, res, next) => {
  try {
    const nouvelle = await agendaService.creerTache(req.body, req.utilisateur || {});
    res.status(201).json(nouvelle);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/agenda/taches/:id/toggle
router.patch("/taches/:id/toggle", async (req, res, next) => {
  try {
    const resu = await agendaService.basculerTache(req.params.id);
    res.json(resu);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/agenda/taches/:id
router.delete("/taches/:id", async (req, res, next) => {
  try {
    const resu = await agendaService.supprimerTache(req.params.id);
    res.json(resu);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
