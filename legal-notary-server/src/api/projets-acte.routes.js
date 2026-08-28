/**
 * src/api/projets-acte.routes.js — Rédaction et révision d'un projet d'acte.
 *
 * `actes:rediger` (clercs, premier clerc, notaire) pour brouillonner et
 * soumettre ; `actes:valider` (notaire uniquement — reflète la réalité
 * légale : seul le notaire titulaire peut authentifier un acte) pour
 * valider ou renvoyer en correction.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const projetsActeService = require("../services/projets-acte.service");

const router = express.Router();

router.get("/:dossierId", async (req, res, next) => {
  try {
    const version = await projetsActeService.obtenirVersionActuelle(req.params.dossierId);
    res.json(version);
  } catch (e) { next(e); }
});

router.get("/:dossierId/historique", async (req, res, next) => {
  try {
    res.json(await projetsActeService.listerHistorique(req.params.dossierId));
  } catch (e) { next(e); }
});

router.put("/:dossierId/brouillon", exigerPermission("actes:rediger"), async (req, res, next) => {
  try {
    const version = await projetsActeService.enregistrerBrouillon(req.params.dossierId, req.body, req.utilisateur.id);
    res.json(version);
  } catch (e) { next(e); }
});

router.post("/:dossierId/soumettre", exigerPermission("actes:rediger"), async (req, res, next) => {
  try {
    const version = await projetsActeService.soumettre(req.params.dossierId, req.utilisateur.id);
    if (!version) return res.status(409).json({ erreur: "Aucun brouillon en cours à soumettre pour ce dossier." });
    res.json(version);
  } catch (e) { next(e); }
});

router.post("/:dossierId/valider", exigerPermission("actes:valider"), async (req, res, next) => {
  try {
    const version = await projetsActeService.valider(req.params.dossierId, req.utilisateur.id, req.body.commentaire);
    if (!version) return res.status(409).json({ erreur: "Aucun projet soumis en attente pour ce dossier." });
    res.json(version);
  } catch (e) { next(e); }
});

router.post("/:dossierId/renvoyer-correction", exigerPermission("actes:valider"), async (req, res, next) => {
  try {
    const version = await projetsActeService.renvoyerPourCorrection(req.params.dossierId, req.utilisateur.id, req.body.commentaire);
    if (!version) return res.status(409).json({ erreur: "Aucun projet soumis en attente pour ce dossier." });
    res.json(version);
  } catch (e) {
    if (e.message.includes("commentaire est requis")) return res.status(400).json({ erreur: e.message });
    next(e);
  }
});

module.exports = router;
