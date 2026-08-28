/**
 * src/api/auth.routes.js — Connexion sécurisée avec protection anti-brute-force.
 *
 * Seule route de toute l'API qui ne demande PAS de jeton en entrée.
 * Protégée par le middleware `limiterTentativesConnexion` et auditée.
 */

const express = require("express");
const authService = require("../services/auth.service");
const {
  limiterTentativesConnexion,
  enregistrerEchecConnexion,
  reinitialiserTentativesConnexion,
} = require("../middleware/securite.middleware");

const router = express.Router();

router.post("/connexion", limiterTentativesConnexion, async (req, res) => {
  const { email, motDePasse } = req.body || {};
  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: "Email et mot de passe requis." });
  }

  const resultat = await authService.connecter(email, motDePasse);
  if (!resultat) {
    enregistrerEchecConnexion(req);
    return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }

  reinitialiserTentativesConnexion(req);
  res.json(resultat);
});

module.exports = router;
