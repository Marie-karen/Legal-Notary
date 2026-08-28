/**
 * src/api/parametres-notifications.routes.js — Configuration SMTP/SMS/
 * WhatsApp/push et modèles de message (permission `parametres:gerer`,
 * notaire uniquement — ces identifiants sont sensibles, voir migration 002).
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const parametresNotifService = require("../services/parametres-notifications.service");
const auditService = require("../services/audit.service");

const router = express.Router();

router.get("/", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    res.json(await parametresNotifService.obtenir());
  } catch (e) { next(e); }
});

router.put("/", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    const resultat = await parametresNotifService.mettreAJour(req.body);
    await auditService.consigner("parametres_notifications", resultat.id, "modification", req.utilisateur.id, Object.keys(req.body));
    res.json(resultat);
  } catch (e) { next(e); }
});

router.get("/modeles", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    res.json(await parametresNotifService.listerModeles());
  } catch (e) { next(e); }
});

router.patch("/modeles/:id", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    const modele = await parametresNotifService.modifierModele(req.params.id, req.body);
    if (!modele) return res.status(404).json({ erreur: "Modèle introuvable." });
    res.json(modele);
  } catch (e) { next(e); }
});

module.exports = router;
