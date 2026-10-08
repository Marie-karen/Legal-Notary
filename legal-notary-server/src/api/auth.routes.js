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

const { lireFichierJson } = require("../services/stockage-persistant.service");

const router = express.Router();

router.get("/etude-info", async (req, res) => {
  try {
    const rawHost = (req.query.host || req.hostname || req.headers.host || "").toLowerCase().replace(/:\d+$/, "");
    const etudes = lireFichierJson("etudes_persistantes.json", []);

    // Recherche par correspondance de domaine (ex: etude-mka.ci, notaire-kouassi.ci, etc.)
    const trouvee = etudes.find((e) => {
      if (!e.domaine) return false;
      const domClean = e.domaine
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      return rawHost === domClean || rawHost.includes(domClean) || (domClean.length > 3 && rawHost.includes(domClean));
    });

    if (trouvee) {
      return res.json({
        trouve: true,
        nomEtude: trouvee.nomEtude,
        titreNotaire: trouvee.titreNotaire || "Maître Notaire",
        ville: trouvee.ville || "Abidjan",
        domaine: trouvee.domaine,
        codeEtude: trouvee.codeEtude,
      });
    }

    res.json({
      trouve: false,
      nomEtude: "Legal Notary",
      titreNotaire: "Maître Notaire",
      ville: "Abidjan",
    });
  } catch (err) {
    res.json({ trouve: false, nomEtude: "Legal Notary" });
  }
});

router.post("/connexion", limiterTentativesConnexion, async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
