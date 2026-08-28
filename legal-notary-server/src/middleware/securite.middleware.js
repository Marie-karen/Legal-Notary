/**
 * src/middleware/securite.middleware.js — En-têtes de sécurité HTTP & Protection Anti-Brute-Force.
 *
 * Implémente :
 * 1. En-têtes HTTP stricts (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc.).
 * 2. Protection Anti-Brute-Force & Rate Limiting en mémoire sur les tentatives de connexion.
 * 3. Journalisation télémétrique des tentatives suspectes.
 */

const telemetrieService = require("../services/telemetrie.service");

// Table de suivi des tentatives de connexion : IP/Email -> { tentatives: number, blocageJusquA: number }
const suiviTentatives = new Map();
const MAX_TENTATIVES_ECHOUEES = 5;
const DUREE_BLOCAGE_MS = 15 * 60 * 1000; // 15 minutes
const FENETRE_RESET_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Middleware d'en-têtes HTTP de sécurité pour toutes les requêtes (API & Web)
 */
function appliquerEnTetesSecurite(req, res, next) {
  // Empêcher l'interprétation MIME incorrecte (anti-MIME sniffing)
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Empêcher l'inclusion dans une iframe malveillante (anti-Clickjacking)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Protection XSS pour les navigateurs plus anciens
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Politique de référencement stricte (ne pas fuiter les URL internes vers des domaines tiers)
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Strict-Transport-Security (HSTS) : forcer HTTPS pendant 1 an
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Content-Security-Policy (CSP)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self';"
  );

  // Pour les routes API, interdire toute mise en cache navigateur pour préserver le secret professionnel
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

/**
 * Middleware de Rate-Limiting & Anti-Brute-Force ciblant /api/auth/connexion
 */
function limiterTentativesConnexion(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "inconnue";
  const email = (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : "sans_email");
  const cle = `${ip}_${email}`;
  const maintenant = Date.now();

  const suivi = suiviTentatives.get(cle);

  if (suivi && suivi.blocageJusquA && maintenant < suivi.blocageJusquA) {
    const minutesRestantes = Math.ceil((suivi.blocageJusquA - maintenant) / 60000);
    telemetrieService.enregistrerErreur({
      source: "anti-brute-force-bloqueur",
      typeErreur: "CompteTemporairementBloque",
      message: `Tentative de connexion sur un compte temporairement bloqué : ${email} depuis ${ip}`,
      niveau: "warning",
      meta: { ip, email, minutesRestantes },
    }).catch(() => {});

    return res.status(429).json({
      erreur: `Trop de tentatives échouées. Compte temporairement verrouillé par sécurité. Veuillez réessayer dans ${minutesRestantes} minute(s).`,
      verrouille: true,
      minutesRestantes,
    });
  }

  // Si le délai de réinitialisation est passé, réinitialiser le compteur
  if (suivi && maintenant - suivi.dernierEssai > FENETRE_RESET_MS) {
    suiviTentatives.delete(cle);
  }

  next();
}

/**
 * Enregistrer un échec de connexion pour le compte / IP
 */
function enregistrerEchecConnexion(req) {
  const ip = req.ip || req.connection.remoteAddress || "inconnue";
  const email = (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : "sans_email");
  const cle = `${ip}_${email}`;
  const maintenant = Date.now();

  const suivi = suiviTentatives.get(cle) || { tentatives: 0, dernierEssai: maintenant, blocageJusquA: null };
  suivi.tentatives += 1;
  suivi.dernierEssai = maintenant;

  if (suivi.tentatives >= MAX_TENTATIVES_ECHOUEES) {
    suivi.blocageJusquA = maintenant + DUREE_BLOCAGE_MS;
    telemetrieService.enregistrerErreur({
      source: "anti-brute-force",
      typeErreur: "SeuilBruteForceAtteint",
      message: `Blocage de sécurité déclenché après ${suivi.tentatives} échecs consécutifs sur ${email} (IP: ${ip})`,
      niveau: "error",
      meta: { ip, email, dureeBlocageMinutes: 15 },
    }).catch(() => {});
  }

  suiviTentatives.set(cle, suivi);
}

/**
 * Réinitialiser le compteur en cas de connexion réussie
 */
function reinitialiserTentativesConnexion(req) {
  const ip = req.ip || req.connection.remoteAddress || "inconnue";
  const email = (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : "sans_email");
  const cle = `${ip}_${email}`;
  suiviTentatives.delete(cle);
}

module.exports = {
  appliquerEnTetesSecurite,
  limiterTentativesConnexion,
  enregistrerEchecConnexion,
  reinitialiserTentativesConnexion,
};
