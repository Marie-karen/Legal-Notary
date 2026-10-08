/**
 * src/api/rapports.routes.js — Routes REST pour les Rapports d'Activité SaaS & Pilotage Direction.
 */

const express = require("express");
const rapportsService = require("../services/rapports.service");

const router = express.Router();

const ROLES_EDITEUR = ["superadmin", "dev", "commercial", "support", "assistante_editeur"];

/**
 * Journalise un refus 403 de façon structurée (S02 / Section 15 bis).
 * Aucun secret, jeton ni corps de requête n'est inscrit dans le journal.
 */
function journaliserRefus403(req) {
  const logStruct = {
    evenement: "ACCES_REFUSE_ROLE",
    statut: 403,
    utilisateurId: (req.utilisateur && req.utilisateur.id) || null,
    role: (req.utilisateur && req.utilisateur.role) || null,
    route: req.originalUrl || req.baseUrl + (req.path || ""),
    methode: req.method,
    dateHeure: new Date().toISOString(),
  };
  console.warn(JSON.stringify(logStruct));
}

/**
 * Middleware strict de contrôle d'accès : refuse (403) tout rôle autre que les rôles éditeur SaaS.
 * Conforme à l'audit de sécurité S02 (section 3) et cahier des charges (section 3 bis, exigence 2).
 */
function exigerEditeur(req, res, next) {
  if (!req.utilisateur) {
    return res.status(401).json({ erreur: "Authentification requise." });
  }
  if (!ROLES_EDITEUR.includes(req.utilisateur.role)) {
    journaliserRefus403(req);
    return res.status(403).json({ erreur: "Accès réservé à l'équipe éditeur SaaS." });
  }
  next();
}

function exigerDirectionSaaS(req, res, next) {
  if (!req.utilisateur) {
    return res.status(401).json({ erreur: "Authentification requise." });
  }
  if (req.utilisateur.role !== "superadmin") {
    journaliserRefus403(req);
    return res.status(403).json({ erreur: "Accès réservé à la Direction Générale SaaS." });
  }
  next();
}

router.use(exigerEditeur);

/**
 * 1. Synthèse globale et KPIs pour la Direction
 */
router.get("/synthese-direction", async (req, res, next) => {
  try {
    const synthese = await rapportsService.obtenirSyntheseDirection();
    res.json(synthese);
  } catch (e) {
    next(e);
  }
});

/**
 * 2. Paramètres de fréquences et d'échéances
 */
router.get("/parametres-frequences", async (req, res, next) => {
  try {
    const params = await rapportsService.obtenirParametresFrequences();
    res.json(params);
  } catch (e) {
    next(e);
  }
});

router.put("/parametres-frequences/:roleCible", exigerDirectionSaaS, async (req, res, next) => {
  try {
    const { roleCible } = req.params;
    const { frequence, jourLimite, heureLimite, actif, descriptionAttendus } = req.body;
    const misAJour = await rapportsService.mettreAJourParametresFrequence({
      roleCible,
      frequence,
      jourLimite,
      heureLimite,
      actif,
      descriptionAttendus,
    });
    res.json(misAJour);
  } catch (e) {
    next(e);
  }
});

/**
 * 3. Rapports pour le collaborateur connecté selon son rôle
 */
router.get("/mes-rapports", async (req, res, next) => {
  try {
    const role = req.utilisateur.role;
    const auteurId = req.utilisateur.id;
    const liste = await rapportsService.listerRapportsParRole(role, role === "superadmin" ? null : auteurId);
    res.json(liste);
  } catch (e) {
    next(e);
  }
});

/**
 * 4. Soumission d'un nouveau rapport d'activité
 */
router.post("/soumettre", async (req, res, next) => {
  try {
    const { titre, periodeDebut, periodeFin, donnees } = req.body;
    if (!titre) {
      return res.status(400).json({ erreur: "Le titre du rapport est requis." });
    }

    const rapport = await rapportsService.soumettreRapport({
      auteurId: req.utilisateur.id,
      auteurNom: req.utilisateur.nomComplet || req.utilisateur.email,
      role: req.utilisateur.role,
      titre,
      periodeDebut,
      periodeFin,
      donnees,
    });
    res.status(201).json(rapport);
  } catch (e) {
    next(e);
  }
});

/**
 * 5. Évaluation / Validation / Commentaire par la Direction
 */
router.post("/:id/evaluer", exigerDirectionSaaS, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, commentaireDirection } = req.body;
    const evalue = await rapportsService.evaluerRapport({
      rapportId: id,
      statut,
      commentaireDirection,
    });
    res.json(evalue);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
