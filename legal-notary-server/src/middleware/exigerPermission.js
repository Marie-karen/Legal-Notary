/**
 * src/middleware/exigerPermission.js — Vérification RBAC par route.
 *
 * Usage : `router.post("/dossiers", authentifier, exigerPermission("dossiers:creer"), gestionnaire)`
 *
 * Cette vérification est indépendante du filtrage de PORTÉE (quels
 * dossiers un rôle peut voir, voir src/rbac/roles.js#porteeDossiers,
 * appliqué dans dossiers.service.js) : ici on vérifie seulement si le rôle
 * a le droit de faire CETTE action-là, quel que soit le dossier concerné.
 * Les deux vérifications sont complémentaires et toutes les deux
 * nécessaires — voir docs/RBAC.md.
 */

const { aPermission } = require("../rbac/roles");

function exigerPermission(permission) {
  return function (req, res, next) {
    if (!req.utilisateur) {
      return res.status(401).json({ erreur: "Authentification requise." });
    }
    if (!aPermission(req.utilisateur.role, permission)) {
      return res.status(403).json({ erreur: "Action non autorisée pour ce rôle." });
    }
    next();
  };
}

module.exports = { exigerPermission };
