/**
 * src/middleware/authentifier.js — Vérifie le jeton JWT de la requête.
 *
 * Attend un en-tête `Authorization: Bearer <jeton>`. Pose `req.utilisateur
 * = { id, role }` si le jeton est valide, renvoie 401 sinon. Toute route
 * de l'API (sauf /api/auth/connexion) passe par ce middleware — voir
 * src/server.js.
 */

const { verifierJeton } = require("../services/auth.service");

function authentifier(req, res, next) {
  const entete = req.headers.authorization || "";
  const [type, jeton] = entete.split(" ");
  if (type !== "Bearer" || !jeton) {
    return res.status(401).json({ erreur: "Authentification requise." });
  }
  const contenu = verifierJeton(jeton);
  if (!contenu) {
    return res.status(401).json({ erreur: "Session invalide ou expirée." });
  }
  req.utilisateur = contenu; // { id, role }
  next();
}

module.exports = { authentifier };
