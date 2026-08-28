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

// =========================================================================
// BARÈMES D'ÉMOLUMENTS (Décret N° 2013-279 et barèmes d'étude)
// =========================================================================
router.get("/baremes", async (req, res, next) => {
  try {
    res.json(await referentielService.listerBaremes());
  } catch (e) { next(e); }
});

router.get("/baremes/:id", async (req, res, next) => {
  try {
    const bareme = await referentielService.obtenirBareme(req.params.id);
    if (!bareme) return res.status(404).json({ erreur: "Barème introuvable." });
    res.json(bareme);
  } catch (e) { next(e); }
});

router.post("/baremes", exigerPermission("referentiel:gerer"), async (req, res, next) => {
  try {
    const nouveau = await referentielService.creerBareme(req.body);
    await auditService.consigner("baremes_emoluments", nouveau.id, "creation", req.utilisateur.id, { libelle: nouveau.libelle });
    res.status(201).json(nouveau);
  } catch (e) { next(e); }
});

router.put("/baremes/:id", exigerPermission("referentiel:gerer"), async (req, res, next) => {
  try {
    const maj = await referentielService.modifierBareme(req.params.id, req.body);
    await auditService.consigner("baremes_emoluments", req.params.id, "modification", req.utilisateur.id, { libelle: req.body.libelle });
    res.json(maj);
  } catch (e) { next(e); }
});

router.delete("/baremes/:id", exigerPermission("referentiel:gerer"), async (req, res, next) => {
  try {
    const supp = await referentielService.supprimerBareme(req.params.id);
    await auditService.consigner("baremes_emoluments", req.params.id, "suppression", req.utilisateur.id, {});
    res.json(supp);
  } catch (e) { next(e); }
});

router.post("/types-actes/:id/associer-bareme", exigerPermission("referentiel:gerer"), async (req, res, next) => {
  try {
    const typeActe = await referentielService.associerBaremeTypeActe(req.params.id, req.body.baremeId);
    if (!typeActe) return res.status(404).json({ erreur: "Type d'acte introuvable." });
    await auditService.consigner("types_actes", req.params.id, "association_bareme", req.utilisateur.id, { baremeId: req.body.baremeId });
    res.json(typeActe);
  } catch (e) { next(e); }
});

module.exports = router;
