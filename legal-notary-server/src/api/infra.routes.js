/**
 * src/api/infra.routes.js — Monitoring d'infrastructure, synchronisation hybride et sauvegardes.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const syncEngineService = require("../services/sync-engine.service");
const monitoringService = require("../services/monitoring-support.service");

const router = express.Router();

router.get("/sync-status", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const statut = await syncEngineService.obtenirStatutSynchronisation();
    res.json(statut);
  } catch (e) { next(e); }
});

router.post("/declencher-sync", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const resultat = await syncEngineService.traiterFileSynchronisation();
    res.json(resultat);
  } catch (e) { next(e); }
});

router.get("/monitoring", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const telemetry = await monitoringService.obtenirMonitoringInstance();
    res.json(telemetry);
  } catch (e) { next(e); }
});

module.exports = router;
