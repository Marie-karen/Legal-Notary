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
const { aPermission, ROLES_ETUDE } = require("../rbac/roles");
const authService = require("../services/auth.service");
const auditService = require("../services/audit.service");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");
    const etudeId = req.utilisateur ? req.utilisateur.etudeId : null;
    res.json(await authService.listerUtilisateurs({ avecSalaires, etudeId }));
  } catch (e) {
    next(e);
  }
});

router.post("/", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");
    const etudeId = req.utilisateur ? req.utilisateur.etudeId : null;
    const { motDePasse, role } = req.body || {};

    // 1. Validation mot de passe
    if (!motDePasse || typeof motDePasse !== "string" || !motDePasse.trim()) {
      return res.status(400).json({ erreur: "Mot de passe obligatoire." });
    }

    // 2. Validation rôle obligatoire (pas de rôle par défaut)
    if (!role || typeof role !== "string" || !role.trim()) {
      return res.status(400).json({ erreur: "Rôle obligatoire." });
    }

    const roleNormalise = role.trim();

    // 3. Validation liste fermée des 7 rôles d'étude
    if (!ROLES_ETUDE.includes(roleNormalise)) {
      return res.status(400).json({ erreur: "Rôle invalide pour un collaborateur d'étude." });
    }

    // 4. Contrôle hiérarchique : un premier clerc ne peut pas créer un notaire ni un premier clerc
    if (
      req.utilisateur.role === "premier_clerc" &&
      (roleNormalise === "notaire" || roleNormalise === "premier_clerc")
    ) {
      return res.status(403).json({ erreur: "Un premier clerc ne peut pas créer un notaire ou un premier clerc." });
    }

    const utilisateur = await authService.creerUtilisateur(
      { ...req.body, role: roleNormalise, etudeId },
      { avecSalaire: avecSalaires }
    );

    await auditService.consigner("utilisateurs", utilisateur.id, "creation", req.utilisateur.id, {
      role: utilisateur.role,
      email: utilisateur.email,
      etudeId,
    });

    res.status(201).json(utilisateur);
  } catch (e) {
    if (e.status === 409 || e.code === "23505") {
      return res.status(409).json({ erreur: "Cette adresse email est déjà utilisée." });
    }
    if (e.status === 400) {
      return res.status(400).json({ erreur: e.message });
    }
    next(e);
  }
});

router.patch("/:id", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const etudeId = req.utilisateur ? req.utilisateur.etudeId : null;
    const avecSalaires = aPermission(req.utilisateur.role, "equipe:voir_salaires");

    // 1. Recherche de la cible et contrôle d'étanchéité d'étude
    const cible = await authService.trouverUtilisateurParId(req.params.id);
    if (!cible || (etudeId && cible.etudeId !== etudeId && cible.etude_id !== etudeId)) {
      return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    // 2. Hiérarchie générale : un premier clerc ne peut pas modifier un notaire ni un autre premier clerc
    if (
      req.utilisateur.role === "premier_clerc" &&
      req.params.id !== req.utilisateur.id &&
      (cible.role === "notaire" || cible.role === "premier_clerc")
    ) {
      return res.status(403).json({ erreur: "Un premier clerc ne peut pas modifier un notaire ou un premier clerc." });
    }

    // 3. Liste fermée des champs modifiables (etude_id, email, actif, mot_de_passe_hash strictement ignorés/rejetés)
    const champsAutorises = {};
    if (req.body.nomComplet !== undefined) champsAutorises.nomComplet = req.body.nomComplet;
    else if (req.body.nom !== undefined || req.body.prenom !== undefined) {
      const nom = req.body.nom || "";
      const prenom = req.body.prenom || "";
      champsAutorises.nomComplet = `${prenom} ${nom}`.trim();
    }
    if (req.body.telephone !== undefined) champsAutorises.telephone = req.body.telephone;
    if (req.body.dateEmbauche !== undefined) champsAutorises.dateEmbauche = req.body.dateEmbauche;
    if (req.body.typeContrat !== undefined) champsAutorises.typeContrat = req.body.typeContrat;
    if (req.body.salaireNet !== undefined) {
      if (!avecSalaires) {
        return res.status(403).json({ erreur: "Seul le notaire peut modifier le salaire." });
      }
      champsAutorises.salaireNet = req.body.salaireNet;
    }

    // 4. Gestion et vérification du rôle
    if (req.body.role !== undefined) {
      const nouveauRole = typeof req.body.role === "string" ? req.body.role.trim() : "";

      // Règle : personne ne modifie son propre rôle
      if (req.params.id === req.utilisateur.id && nouveauRole !== req.utilisateur.role) {
        return res.status(403).json({ erreur: "Impossible de modifier son propre rôle." });
      }

      // Validation contre la liste fermée des 7 rôles d'étude
      if (!ROLES_ETUDE.includes(nouveauRole)) {
        return res.status(400).json({ erreur: "Rôle invalide pour un collaborateur d'étude." });
      }

      // Règle hiérarchie pour premier clerc
      if (req.utilisateur.role === "premier_clerc" && (nouveauRole === "notaire" || nouveauRole === "premier_clerc")) {
        return res
          .status(403)
          .json({ erreur: "Un premier clerc ne peut pas attribuer le rôle de notaire ou de premier clerc." });
      }

      // Règle : interdire de rétrograder le DERNIER notaire actif de l'étude
      if (cible.role === "notaire" && nouveauRole !== "notaire") {
        const nbNotairesActifs = await authService.compterNotairesActifs(etudeId);
        if (nbNotairesActifs <= 1) {
          return res.status(403).json({ erreur: "Impossible de rétrograder le dernier notaire actif de l'étude." });
        }
      }

      champsAutorises.role = nouveauRole;
    }

    const utilisateur = await authService.modifierUtilisateur(req.params.id, champsAutorises, {
      avecSalaire: avecSalaires,
      etudeId,
    });
    if (!utilisateur) return res.status(404).json({ erreur: "Utilisateur introuvable." });

    // Journalisation structurée dans journal_audit
    const actionAudit =
      champsAutorises.role && champsAutorises.role !== cible.role ? "changement_role" : "modification";
    await auditService.consigner("utilisateurs", req.params.id, actionAudit, req.utilisateur.id, {
      champsModifies: Object.keys(champsAutorises),
      ancienRole: cible.role,
      nouveauRole: champsAutorises.role || cible.role,
      etudeId,
    });

    res.json(utilisateur);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", exigerPermission("equipe:gerer"), async (req, res, next) => {
  try {
    const etudeId = req.utilisateur ? req.utilisateur.etudeId : null;

    // 1. Interdiction de désactiver son propre compte
    if (req.params.id === req.utilisateur.id) {
      return res.status(403).json({ erreur: "Impossible de désactiver son propre compte." });
    }

    // 2. Recherche et contrôle d'étanchéité d'étude
    const cible = await authService.trouverUtilisateurParId(req.params.id);
    if (!cible || (etudeId && cible.etudeId !== etudeId && cible.etude_id !== etudeId)) {
      return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    // 3. Contrôle hiérarchique pour premier clerc
    if (req.utilisateur.role === "premier_clerc" && (cible.role === "notaire" || cible.role === "premier_clerc")) {
      return res
        .status(403)
        .json({ erreur: "Un premier clerc ne peut pas désactiver un notaire ou un premier clerc." });
    }

    // 4. Interdiction de désactiver le DERNIER notaire actif de l'étude
    if (cible.role === "notaire") {
      const nbNotairesActifs = await authService.compterNotairesActifs(etudeId);
      if (nbNotairesActifs <= 1) {
        return res.status(403).json({ erreur: "Impossible de désactiver le dernier notaire actif de l'étude." });
      }
    }

    const succes = await authService.desactiverUtilisateur(req.params.id, { etudeId });
    if (!succes) return res.status(404).json({ erreur: "Utilisateur introuvable." });

    await auditService.consigner("utilisateurs", req.params.id, "desactivation", req.utilisateur.id, {
      role: cible.role,
      email: cible.email,
      etudeId,
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
