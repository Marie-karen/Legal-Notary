/**
 * src/api/referentiel.routes.js — Catalogue des actes, consultation et
 * réglage des durées (permission `referentiel:gerer`, notaire/premier
 * clerc — voir docs/RBAC.md).
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const referentielService = require("../services/referentiel.service");
const auditService = require("../services/audit.service");

const router = express.Router();

router.get("/classifications", async (req, res, next) => {
  try {
    res.json(await referentielService.listerClassifications());
  } catch (e) { next(e); }
});

router.get("/types-actes", async (req, res, next) => {
  try {
    res.json(await referentielService.listerTypesActes());
  } catch (e) { next(e); }
});

router.get("/types-actes/:id/taches-standard", async (req, res, next) => {
  try {
    res.json(await referentielService.listerTachesStandard(req.params.id));
  } catch (e) { next(e); }
});

router.post("/types-actes", exigerPermission("referentiel:creer_acte"), async (req, res, next) => {
  try {
    const nouveauTypeActe = await referentielService.creerTypeActe(req.body);
    await auditService.consigner("types_actes", nouveauTypeActe.id, "creation", req.utilisateur.id, { libelle: nouveauTypeActe.libelle });
    res.status(201).json(nouveauTypeActe);
  } catch (e) { next(e); }
});

router.post("/types-actes/:id/taches-standard", exigerPermission("referentiel:creer_etape"), async (req, res, next) => {
  try {
    const nouvelleTache = await referentielService.ajouterTacheStandard(req.params.id, req.body);
    await auditService.consigner("taches_standard", nouvelleTache.id, "creation_etape", req.utilisateur.id, { libelle: nouvelleTache.libelle });
    res.status(201).json(nouvelleTache);
  } catch (e) { next(e); }
});

router.patch("/taches-standard/:id/duree", exigerPermission("referentiel:fixer_delais"), async (req, res, next) => {
  try {
    const typeActe = await referentielService.modifierDureeTache(req.params.id, req.body.dureeJours);
    if (!typeActe) return res.status(404).json({ erreur: "Tâche introuvable." });
    await auditService.consigner("taches_standard", req.params.id, "modification_duree", req.utilisateur.id, { dureeJours: req.body.dureeJours });
    res.json(typeActe);
  } catch (e) { next(e); }
});

module.exports = router;
