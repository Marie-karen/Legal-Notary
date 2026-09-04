/**
 * src/middleware/controlHubAuth.middleware.js
 *
 * Middleware de sécurité pour l'API Interne (/api/internal/*).
 * Authentifie les requêtes provenant du SaaS de Contrôle Centralisé (Master Super Admin Hub)
 * via la clé secrète partagée CONTROL_HUB_SECRET_KEY.
 */

const crypto = require("crypto");

function exigerCleControlHub(req, res, next) {
  const secretAttendu = process.env.CONTROL_HUB_SECRET_KEY;

  if (!secretAttendu || !secretAttendu.trim()) {
    console.error("[ControlHubAuth] Erreur de configuration : CONTROL_HUB_SECRET_KEY n'est pas définie sur ce serveur.");
    return res.status(500).json({
      erreur: "Erreur de configuration serveur : Clé de contrôle interne non configurée.",
    });
  }

  // 1. Récupération de la clé fournie (via header custom ou Authorization Bearer)
  let secretFourni = req.headers["x-control-hub-secret"] || "";

  if (!secretFourni) {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
      secretFourni = authHeader.slice(7).trim();
    }
  }

  if (!secretFourni || typeof secretFourni !== "string") {
    return res.status(401).json({
      erreur: "Accès refusé : En-tête 'x-control-hub-secret' ou 'Authorization: Bearer' requis pour l'API interne.",
    });
  }

  // 2. Comparaison en temps constant (Timing Safe Equal) pour éviter les attaques temporelles
  try {
    const bufAttendu = Buffer.from(secretAttendu, "utf8");
    const bufFourni = Buffer.from(secretFourni, "utf8");

    if (bufAttendu.length !== bufFourni.length || !crypto.timingSafeEqual(bufAttendu, bufFourni)) {
      return res.status(401).json({
        erreur: "Accès refusé : Clé secrète de contrôle interne invalide.",
      });
    }
  } catch (err) {
    return res.status(401).json({
      erreur: "Accès refusé : Échec de validation de la clé de contrôle.",
    });
  }

  // Clé valide : on poursuit
  req.estControlHub = true;
  next();
}

module.exports = { exigerCleControlHub };
