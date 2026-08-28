/**
 * src/api/rapports.routes.js — Routes REST pour les Rapports d'Activité SaaS & Pilotage Direction.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const rapportsService = require("../services/rapports.service");

const router = express.Router();

function exigerDirectionSaaS(req, res, next) {
  if (!req.utilisateur || req.utilisateur.role !== "superadmin") {
    return res.status(403).json({ erreur: "Accès réservé à la Direction Générale SaaS." });
  }
  next();
}

/**
 * 1. Synthèse globale et KPIs pour la Direction
 */
router.get("/synthese-direction", async (req, res, next) => {
  try {
    const synthese = await rapportsService.obtenirSyntheseDirection();
    res.json(synthese);
  } catch (e) { next(e); }
});

/**
 * 2. Paramètres de fréquences et d'échéances
 */
router.get("/parametres-frequences", async (req, res, next) => {
  try {
    const params = await rapportsService.obtenirParametresFrequences();
    res.json(params);
  } catch (e) { next(e); }
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
  } catch (e) { next(e); }
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
  } catch (e) { next(e); }
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
  } catch (e) { next(e); }
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
  } catch (e) { next(e); }
});

module.exports = router;
