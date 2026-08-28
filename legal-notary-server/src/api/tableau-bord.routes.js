/**
 * src/api/tableau-bord.routes.js — Statistiques d'évolution par clerc.
 *
 * Un clerc/assistante ne peut consulter que SES propres statistiques
 * (`req.params.utilisateurId` doit correspondre à `req.utilisateur.id`).
 * Le notaire, le premier clerc et le comptable (portée "tous" sur les
 * dossiers, voir src/rbac/roles.js) peuvent consulter n'importe qui.
 */

const express = require("express");
const { porteeDossiers } = require("../rbac/roles");
const tableauBordService = require("../services/tableau-bord.service");

const router = express.Router();

router.get("/evolution/:utilisateurId", async (req, res, next) => {
  try {
    const estSoiMeme = req.params.utilisateurId === req.utilisateur.id;
    const aVueGlobale = porteeDossiers(req.utilisateur.role) === "tous";
    if (!estSoiMeme && !aVueGlobale) {
      return res.status(403).json({ erreur: "Vous ne pouvez consulter que vos propres statistiques." });
    }
    res.json(await tableauBordService.obtenirEvolutionUtilisateur(req.params.utilisateurId));
  } catch (e) { next(e); }
});

module.exports = router;
