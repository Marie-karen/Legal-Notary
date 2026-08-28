/**
 * src/api/auth.routes.js — Connexion.
 *
 * Seule route de toute l'API qui ne demande PAS de jeton en entrée
 * (logiquement : c'est elle qui en délivre un). Toutes les autres routes
 * sont montées derrière le middleware `authentifier` dans src/server.js.
 */

const express = require("express");
const authService = require("../services/auth.service");

const router = express.Router();

router.post("/connexion", async (req, res) => {
  const { email, motDePasse } = req.body || {};
  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: "Email et mot de passe requis." });
  }
  const resultat = await authService.connecter(email, motDePasse);
  if (!resultat) {
    return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }
  res.json(resultat);
});

module.exports = router;
