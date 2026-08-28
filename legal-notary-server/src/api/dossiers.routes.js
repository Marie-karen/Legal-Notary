/**
 * src/api/dossiers.routes.js — Dossiers : création, consultation, cycle de
 * vie, checklist, compte client.
 *
 * Rappel RBAC (voir docs/RBAC.md) : QUI peut voir QUELS dossiers est décidé
 * dans dossiers.service.js (portée par rôle), pas ici. Ici on vérifie
 * seulement la permission d'ACTION (`exigerPermission`). Les deux se
 * combinent : un clerc rédacteur avec `dossiers:creer` peut créer un
 * dossier, mais `listerDossiersPourUtilisateur` ne lui montrera ensuite
 * que ceux qui lui sont assignés.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const dossiersService = require("../services/dossiers.service");
const archivesService = require("../services/archives.service");

const router = express.Router();

router.get("/", exigerPermission("dossiers:voir_tous"), async (req, res, next) => {
  try {
    const dossiers = await dossiersService.listerDossiersPourUtilisateur(req.utilisateur, req.query);
    res.json(dossiers);
  } catch (e) { next(e); }
});

// Variante pour les rôles qui n'ont que "voir_assignes" ou "voir_formalites"
// (le service applique de toute façon la bonne portée selon le rôle
// réel — cette deuxième route existe seulement pour ne pas bloquer un
// clerc/assistante/formaliste qui n'a pas la permission "voir_tous").
router.get("/mes-dossiers", async (req, res, next) => {
  try {
    const dossiers = await dossiersService.listerDossiersPourUtilisateur(req.utilisateur, req.query);
    res.json(dossiers);
  } catch (e) { next(e); }
});

router.post("/", exigerPermission("dossiers:creer"), async (req, res, next) => {
  try {
    const dossier = await dossiersService.creerDossier({ ...req.body, creeParId: req.utilisateur.id, creeParRole: req.utilisateur.role });
    res.status(201).json(dossier);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const dossier = await dossiersService.obtenirDossierPourUtilisateur(req.params.id, req.utilisateur);
    if (!dossier) return res.status(404).json({ erreur: "Dossier introuvable." });
    res.json(dossier);
  } catch (e) { next(e); }
});

// Ces trois routes exigent `taches:modifier` (même famille d'action que
// modifier une tâche : faire avancer le dossier) ET que le dossier soit
// dans la portée RBAC de l'appelant (vérifié dans le service — voir
// dossiers.service.js#verifierPortee, sans quoi un clerc rédacteur
// pourrait modifier un dossier qui n'est pas le sien en devinant son id).
router.post("/:id/etape", exigerPermission("taches:modifier"), async (req, res, next) => {
  try {
    const dossier = await dossiersService.changerEtape(req.params.id, req.body.etape, req.utilisateur);
    if (!dossier) return res.status(404).json({ erreur: "Dossier introuvable." });
    res.json(dossier);
  } catch (e) { next(e); }
});

router.post("/:id/reporter", exigerPermission("taches:modifier"), async (req, res, next) => {
  try {
    const resultat = await dossiersService.reporterEcheance(req.params.id, req.body.jours || 1, req.utilisateur);
    if (!resultat) return res.status(404).json({ erreur: "Dossier introuvable." });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post("/:id/relancer", exigerPermission("taches:modifier"), async (req, res, next) => {
  try {
    const resultat = await dossiersService.relancerClerc(req.params.id, req.utilisateur, req.body.nomClerc);
    if (!resultat) return res.status(404).json({ erreur: "Dossier introuvable." });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post("/taches/:tacheId/statut", exigerPermission("taches:modifier"), async (req, res, next) => {
  try {
    const resultat = await dossiersService.majStatutTache(req.params.tacheId, req.body.statut, req.utilisateur);
    if (!resultat) return res.status(404).json({ erreur: "Tâche introuvable." });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post("/:id/compte-client", exigerPermission("finances:modifier_compte_client"), async (req, res, next) => {
  try {
    await dossiersService.ajouterEcritureCompteClient(req.params.id, req.body, req.utilisateur.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post("/:id/cloturer", exigerPermission("dossiers:cloturer"), async (req, res, next) => {
  try {
    const minute = await archivesService.cloturerDossier(req.params.id, req.utilisateur.id);
    res.status(201).json(minute);
  } catch (e) { next(e); }
});

module.exports = router;
