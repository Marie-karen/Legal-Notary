/**
 * src/api/equipe.routes.js — Gestion des utilisateurs du cabinet
 * (permission `equipe:gerer`, notaire et premier clerc).
 *
 * Le salaire net n'est renvoyé que si l'appelant a la permission
 * `equipe:voir_salaires` (notaire uniquement) — voir
 * src/services/auth.service.js#utilisateurVersCamel. Un premier clerc
 * peut gérer l'équipe (créer/désactiver un compte) sans jamais voir les
 * salaires.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const { aPermission } = require("../rbac/roles");
const authService = require("../services/auth.service");
const auditService = require("../services/audit.service");

const router = express.Router();

router.get("/", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");
    res.json(await authService.listerUtilisateurs({ avecSalaires }));
  } catch (e) { next(e); }
});

router.post("/", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");
    const utilisateur = await authService.creerUtilisateur(req.body, { avecSalaire: avecSalaires });
    await auditService.consigner("utilisateurs", utilisateur.id, "creation", req.utilisateur.id, { role: utilisateur.role, email: utilisateur.email });
    res.status(201).json(utilisateur);
  } catch (e) { next(e); }
});

router.patch("/:id", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");
    if (!avecSalaires && req.body.salaireNet !== undefined) {
      return res.status(403).json({ erreur: "Seul le notaire peut modifier le salaire." });
    }
    const utilisateur = await authService.modifierUtilisateur(req.params.id, req.body, { avecSalaire: avecSalaires });
    if (!utilisateur) return res.status(404).json({ erreur: "Utilisateur introuvable." });
    await auditService.consigner("utilisateurs", req.params.id, "modification", req.utilisateur.id, Object.keys(req.body));
    res.json(utilisateur);
  } catch (e) { next(e); }
});

router.delete("/:id", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    await authService.desactiverUtilisateur(req.params.id);
    await auditService.consigner("utilisateurs", req.params.id, "desactivation", req.utilisateur.id, null);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
