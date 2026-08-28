/**
 * src/api/infra.routes.js — Monitoring d'infrastructure, synchronisation hybride, PRA & Sauvegardes WORM.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const syncEngineService = require("../services/sync-engine.service");
const monitoringService = require("../services/monitoring-support.service");
const sauvegardeImmuableService = require("../services/sauvegarde-immuable.service");

const router = express.Router();

// Synchronisation hybride & offline
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

// Santé de l'instance & monitoring
router.get("/monitoring", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const telemetry = await monitoringService.obtenirMonitoringInstance();
    res.json(telemetry);
  } catch (e) { next(e); }
});

// -----------------------------------------------------------------
// Sauvegardes Immuables WORM & Simulation Plan de Reprise d'Activité
// -----------------------------------------------------------------
router.post("/sauvegarde/generer-snapshot", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const etudeId = req.utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";
    const typeSnapshot = req.body.typeSnapshot || "manuel_securite";
    const snapshot = await sauvegardeImmuableService.genererSnapshotWORM({
      etudeId,
      typeSnapshot,
      initiePar: req.utilisateur.nomComplet || req.utilisateur.email,
    });
    res.json(snapshot);
  } catch (e) { next(e); }
});

router.get("/sauvegarde/snapshots", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const etudeId = req.utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";
    const liste = await sauvegardeImmuableService.listerSnapshots({ etudeId });
    res.json(liste);
  } catch (e) { next(e); }
});

router.post("/sauvegarde/tester-pra", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const etudeId = req.utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";
    const { snapshotId } = req.body;
    if (!snapshotId) {
      return res.status(400).json({ erreur: "snapshotId requis pour exécuter la simulation de PRA." });
    }
    const rapport = await sauvegardeImmuableService.simulerPlanRepriseActivite({ snapshotId, etudeId });
    res.json(rapport);
  } catch (e) { next(e); }
});

// Diagnostic & Contrôle de l'Espace Disque
router.get("/disque/diagnostic", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const diag = await sauvegardeImmuableService.diagnostiquerEtNettoyerDisque({ nettoyer: false });
    res.json(diag);
  } catch (e) { next(e); }
});

router.post("/disque/nettoyer", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const resu = await sauvegardeImmuableService.diagnostiquerEtNettoyerDisque({ nettoyer: true });
    res.json(resu);
  } catch (e) { next(e); }
});

module.exports = router;
