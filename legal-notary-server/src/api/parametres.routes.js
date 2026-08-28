/**
 * src/api/parametres.routes.js — Réglages du cabinet (permission
 * `parametres:gerer`, notaire uniquement — voir docs/RBAC.md).
 *
 * La lecture (GET) n'est volontairement pas restreinte à cette permission
 * précise : plusieurs services (fiscal, alertes) ont besoin de connaître
 * les seuils/taux quel que soit le rôle de la personne connectée. Seule
 * l'écriture (PUT) est protégée.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const parametresService = require("../services/parametres.service");
const auditService = require("../services/audit.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await parametresService.obtenir());
  } catch (e) { next(e); }
});

router.put("/", exigerPermission("parametres:gerer"), async (req, res, next) => {
  try {
    const resultat = await parametresService.mettreAJour(req.body);
    await auditService.consigner("parametres_etude", resultat.id, "modification", req.utilisateur.id, req.body);
    res.json(resultat);
  } catch (e) { next(e); }
});

module.exports = router;
