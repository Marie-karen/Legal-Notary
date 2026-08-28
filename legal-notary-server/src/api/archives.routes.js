/**
 * src/api/archives.routes.js — File d'attente d'archivage, archivage
 * physique (oldest-first) et répertoire chronologique des minutes.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const archivesService = require("../services/archives.service");
const mouvementsService = require("../services/mouvements-physiques.service");
const campagnesService = require("../services/campagnes-numerisation.service");
const numerisationOcrService = require("../services/numerisation-ocr.service");
const rechercheUnifieeService = require("../services/recherche-unifiee.service");

const router = express.Router();

router.get("/en-attente", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await archivesService.listerEnAttenteArchivage());
  } catch (e) { next(e); }
});

router.get("/repertoire", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await archivesService.listerRepertoire());
  } catch (e) { next(e); }
});

router.get("/cartons", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await archivesService.listerCartons());
  } catch (e) { next(e); }
});

router.post("/cartons", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const carton = await archivesService.creerCarton(req.body || {});
    res.status(201).json(carton);
  } catch (e) { next(e); }
});

router.post("/numeriser-et-archiver", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const resultat = await archivesService.numeriserEtArchiver(req.body || {}, req.utilisateur.id);
    res.status(201).json(resultat);
  } catch (e) { next(e); }
});

// Consultation 360° du jumeau numérique et physique
router.get("/dossiers/:dossierId/jumeau", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const details = await archivesService.obtenirDetailsJumeauDossier(req.params.dossierId);
    if (!details) return res.status(404).json({ erreur: "Dossier introuvable." });
    res.json(details);
  } catch (e) { next(e); }
});

// Traçabilité des mouvements physiques
router.get("/mouvements", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await mouvementsService.listerMouvements());
  } catch (e) { next(e); }
});

router.post("/mouvements/sortie", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const r = await mouvementsService.enregistrerDemandeSortie({
      ...req.body,
      utilisateurId: req.utilisateur.id,
      roleUtilisateur: req.utilisateur.role,
    });
    res.status(201).json(r);
  } catch (e) { next(e); }
});

router.post("/mouvements/demande", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const r = await mouvementsService.enregistrerDemandeSortie({
      ...req.body,
      utilisateurId: req.utilisateur.id,
      roleUtilisateur: req.utilisateur.role,
    });
    res.status(201).json(r);
  } catch (e) { next(e); }
});

router.post("/mouvements/:id/approuver", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const r = await mouvementsService.approuverDemandeSortie({
      mouvementId: req.params.id,
      utilisateurId: req.utilisateur.id,
    });
    res.json(r);
  } catch (e) { next(e); }
});

router.post("/mouvements/:id/retour", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const r = await mouvementsService.enregistrerRetourPhysique({
      mouvementId: req.params.id,
      ...(req.body || {}),
    });
    res.status(200).json(r);
  } catch (e) { next(e); }
});

router.post("/mouvements/retour", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const r = await mouvementsService.enregistrerRetourPhysique(req.body || {});
    res.status(200).json(r);
  } catch (e) { next(e); }
});

// Campagnes de numérisation historiques
router.get("/campagnes", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    res.json(await campagnesService.listerCampagnes());
  } catch (e) { next(e); }
});

router.post("/campagnes", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const c = await campagnesService.creerCampagne({
      ...req.body,
      responsableId: req.utilisateur.id,
    });
    res.status(201).json(c);
  } catch (e) { next(e); }
});

router.post("/campagnes/:id/avancement", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const c = await campagnesService.enregistrerAvancementLot({
      campagneId: req.params.id,
      nombreNumerisesAjoutes: req.body.nombre || 1,
    });
    res.json(c);
  } catch (e) { next(e); }
});

// Pipeline Scan, OCR & IA
router.post("/scan-ocr-ia", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const proposition = await numerisationOcrService.traiterScanEtProposerIA(req.body || {});
    res.json(proposition);
  } catch (e) { next(e); }
});

router.post("/valider-document", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const doc = await numerisationOcrService.validerEtEnregistrerDocument({
      ...req.body,
      utilisateurId: req.utilisateur.id,
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

router.post("/piece-physique-non-numerisable", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const doc = await numerisationOcrService.enregistrerDocumentPhysiqueNonNumerisable({
      ...req.body,
      utilisateurId: req.utilisateur.id,
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// Recherche unifiée
router.get("/recherche-unifiee", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    const resultats = await rechercheUnifieeService.rechercher({ query: req.query.q || "" });
    res.json(resultats);
  } catch (e) { next(e); }
});

// Archive FIFO
router.post("/archiver-suivant", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const resultat = await archivesService.archiverProchainDossier(req.utilisateur.id);
    if (!resultat) return res.status(204).end();
    res.status(201).json(resultat);
  } catch (e) { next(e); }
});

router.post("/archiver-lot", exigerPermission("archives:archiver_physiquement"), async (req, res, next) => {
  try {
    const resultats = await archivesService.archiverEnLot(req.body.nombre || 1, req.utilisateur.id);
    res.status(201).json(resultats);
  } catch (e) { next(e); }
});

router.post("/dossiers/:dossierId/scan", exigerPermission("archives:acceder"), async (req, res, next) => {
  try {
    await archivesService.attacherScan(req.params.dossierId, req.body.scanUrl);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
