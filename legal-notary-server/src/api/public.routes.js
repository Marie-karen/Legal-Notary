/**
 * src/api/public.routes.js — Routes publiques pour la landing page et les demandes de démo.
 */

const express = require("express");
const router = express.Router();
const demandeDemoService = require("../services/demande-demo.service");

// Mémoire de limitation de débit (Anti-Spam Rate Limiter)
const IP_RATE_LIMIT = new Map();
const RATE_LIMIT_FENETRE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_DEMANDES_PAR_FENETRE = 5;

function verifierLimitationDebit(ip) {
  const maintenant = Date.now();
  const historique = IP_RATE_LIMIT.get(ip) || [];
  const recents = historique.filter((t) => maintenant - t < RATE_LIMIT_FENETRE_MS);
  if (recents.length >= MAX_DEMANDES_PAR_FENETRE) {
    return false;
  }
  recents.push(maintenant);
  IP_RATE_LIMIT.set(ip, recents);
  return true;
}

// POST /api/public/demande-demo
router.post("/demande-demo", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

    // 1. Anti-spam Honeypot : si le champ masqué 'website' est rempli, c'est un bot
    if (body.website || body.champ_piege) {
      console.warn(`[AntiSpam] Bot détecté et silencieusement rejeté depuis l'IP ${ip}`);
      // On simule un succès pour ne pas donner d'indice au bot
      return res.json({
        success: true,
        message: "Votre demande a été prise en compte.",
      });
    }

    // 2. Limitation de fréquence par IP
    if (!verifierLimitationDebit(ip)) {
      return res.status(429).json({
        erreur: "Trop de requêtes envoyées depuis cette adresse. Veuillez patienter quelques minutes.",
      });
    }

    // 3. Validation des données
    const { nomPrenom, nomEtude, villePays, fonction, telephoneWhatsapp, email, message, consentement } = body;

    if (!nomPrenom || nomPrenom.trim().length < 2) {
      return res.status(400).json({ erreur: "Veuillez renseigner votre nom et prénom." });
    }
    if (!nomEtude || nomEtude.trim().length < 2) {
      return res.status(400).json({ erreur: "Veuillez renseigner le nom de votre étude notariale." });
    }
    if (!telephoneWhatsapp || telephoneWhatsapp.trim().length < 6) {
      return res.status(400).json({ erreur: "Veuillez indiquer un numéro WhatsApp valide pour la prise de contact." });
    }
    if (!email || !email.includes("@") || !email.includes(".")) {
      return res.status(400).json({ erreur: "Veuillez saisir une adresse email professionnelle valide." });
    }
    if (consentement === false || consentement === "false") {
      return res.status(400).json({ erreur: "Le consentement au traitement des données pour la démonstration est requis." });
    }

    // 4. Enregistrement de la demande
    const resultat = await demandeDemoService.enregistrerDemandeDemo({
      nomPrenom,
      nomEtude,
      villePays,
      fonction,
      telephoneWhatsapp,
      email,
      message,
      consentement: true,
      ipClient: ip,
    });

    res.status(201).json(resultat);
  } catch (err) {
    console.error("[DemandeDemo] Erreur traitement :", err);
    next(err);
  }
});

module.exports = router;
