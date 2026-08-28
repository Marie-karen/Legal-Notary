/**
 * src/api/support.routes.js — Portail Support L1-L4 & Gestion des accès temporaires audités.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const monitoringSupportService = require("../services/monitoring-support.service");

const router = express.Router();

router.get("/tickets", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await monitoringSupportService.listerTickets());
  } catch (e) { next(e); }
});

router.post("/tickets", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const ticket = await monitoringSupportService.creerTicketSupport({
      ...req.body,
      utilisateurId: req.utilisateur.id,
    });
    res.status(201).json(ticket);
  } catch (e) { next(e); }
});

router.post("/tickets/:id/accorder-acces", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    const r = await monitoringSupportService.accorderAccesTemporaireSupport({
      ticketId: req.params.id,
      motif: req.body.motif,
      dureeMinutes: req.body.dureeMinutes || 60,
      intervenantSupport: req.body.intervenantSupport,
      utilisateurId: req.utilisateur.id,
    });
    res.json(r);
  } catch (e) { next(e); }
});

module.exports = router;
