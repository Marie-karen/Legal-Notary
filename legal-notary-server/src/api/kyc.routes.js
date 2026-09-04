/**
 * src/api/kyc.routes.js — Routes de gestion des Fiches KYC et portail QR Code
 */

const express = require("express");
const kycService = require("../services/kyc.service");
const { authentifier } = require("../middleware/authentifier");

const router = express.Router();

// =========================================================================
// ROUTES PUBLIQUES (Accès direct du client via scan du QR Code ou lien)
// =========================================================================

router.get("/public/:token", async (req, res, next) => {
  try {
    const data = await kycService.obtenirFormulaireKycPublic(req.params.token);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post("/public/:token/soumettre", async (req, res, next) => {
  try {
    const data = await kycService.soumettreKycClient(
      req.params.token,
      req.body,
      req.ip,
      req.headers["user-agent"]
    );
    res.json({ message: "Fiche KYC enregistrée avec succès", kyc: data });
  } catch (e) {
    next(e);
  }
});

// =========================================================================
// ROUTES AUTHENTIFIÉES (Office Notarial / Clerc / Notaire)
// =========================================================================

router.use(authentifier);

router.get("/dossier/:dossierId/token", async (req, res, next) => {
  try {
    const data = await kycService.genererOuRecupererTokenKyc(
      req.params.dossierId,
      req.utilisateur ? req.utilisateur.id : null
    );
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/dossier/:dossierId", async (req, res, next) => {
  try {
    const data = await kycService.obtenirKycDossier(req.params.dossierId);
    res.json(data || { statut: "non_initie" });
  } catch (e) {
    next(e);
  }
});

router.post("/dossier/:dossierId/valider", async (req, res, next) => {
  try {
    const data = await kycService.validerKycDossier(
      req.params.dossierId,
      req.utilisateur ? req.utilisateur.id : null
    );
    res.json({ message: "Fiche KYC validée", kyc: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
