/**
 * src/api/telemetrie.routes.js — Routes REST pour la Télémétrie d'Erreurs,
 * les Heartbeats des serveurs physiques et la supervision DevOps.
 */

const express = require("express");
const router = express.Router();
const telemetrieService = require("../services/telemetrie.service");
const { authentifier } = require("../middleware/authentifier");

function exigerSaaS(req, res, next) {
  const rolesSaaS = ["superadmin", "dev", "commercial", "support", "assistante_editeur"];
  if (!req.utilisateur || !rolesSaaS.includes(req.utilisateur.role)) {
    return res.status(403).json({ erreur: "Accès réservé à l'équipe éditeur SaaS." });
  }
  next();
}

// 1. Endpoint public / edge pour la réception des erreurs (Cloud + Serveurs Locaux + Web)
router.post("/erreurs", async (req, res, next) => {
  try {
    const err = await telemetrieService.enregistrerErreur(req.body);
    res.status(201).json({ succes: true, id: err.id });
  } catch (e) {
    next(e);
  }
});

// 2. Endpoint Heartbeat des serveurs physiques locaux (envoyé toutes les 30s par les mini-serveurs)
router.post("/heartbeat", async (req, res, next) => {
  try {
    const noeud = await telemetrieService.recevoirHeartbeat(req.body);
    res.json({ succes: true, statut: noeud.statut, recuLe: noeud.derniere_activite });
  } catch (e) {
    next(e);
  }
});

// 3. Lister les erreurs du parc (Réservé SuperAdmin / Dev / Support)
router.get("/erreurs", authentifier, exigerSaaS, async (req, res, next) => {
  try {
    const { limite, niveau, statut } = req.query;
    const erreurs = await telemetrieService.listerErreursParc({
      limite: parseInt(limite, 10) || 50,
      niveau,
      statut,
    });
    res.json(erreurs);
  } catch (e) {
    next(e);
  }
});

// 4. Marquer une erreur comme résolue
router.put("/erreurs/:id/resoudre", authentifier, exigerSaaS, async (req, res, next) => {
  try {
    const maj = await telemetrieService.resoudreErreur(req.params.id);
    res.json(maj);
  } catch (e) {
    next(e);
  }
});

// 5. Lister la santé en temps réel de tous les serveurs physiques locaux du parc
router.get("/noeuds", authentifier, exigerSaaS, async (req, res, next) => {
  try {
    const noeuds = await telemetrieService.surveillerSanteNoeuds();
    res.json(noeuds);
  } catch (e) {
    next(e);
  }
});

// 6. Déclencher un test d'alerte critique
router.post("/test-alerte", authentifier, exigerSaaS, async (req, res, next) => {
  try {
    const test = await telemetrieService.testerAlerteCritique();
    res.json({ succes: true, message: "Alerte test envoyée avec succès au canal DevOps !", incident: test });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
