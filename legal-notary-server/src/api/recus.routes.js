/**
 * src/api/recus.routes.js — Routes API pour la gestion et validation des Reçus de Paiement Notariaux.
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const recusService = require("../services/recus.service");

const router = express.Router();

// Lister les reçus (Comptable, Notaire, Premier Clerc)
router.get("/", async (req, res, next) => {
  try {
    const recus = await recusService.listerRecusPourUtilisateur(
      req.utilisateur,
      req.query,
    );
    res.json(recus);
  } catch (e) {
    next(e);
  }
});

// Obtenir le détail d'un reçu
router.get("/:id", async (req, res, next) => {
  try {
    const recu = await recusService.obtenirRecuParId(req.params.id);
    if (!recu)
      return res.status(404).json({ erreur: "Reçu de paiement introuvable." });
    res.json(recu);
  } catch (e) {
    next(e);
  }
});

// Créer un reçu de paiement (Comptable Taxateur, Notaire)
router.post("/", async (req, res, next) => {
  try {
    const {
      dossierId,
      numeroDossier,
      typeActeId,
      clientNom,
      clientEmail,
      clientTelephone,
      fraisOuverture,
      provision,
      montantProvision,
      montantAssiette,
      modePaiement,
      observations,
    } = req.body || {};

    const recu = await recusService.creerRecuPaiement({
      etudeId: req.utilisateur ? req.utilisateur.etudeId : null,
      dossierId,
      numeroDossier,
      typeActeId,
      clientNom,
      clientEmail,
      clientTelephone,
      fraisOuverture,
      provision: provision !== undefined ? provision : montantProvision,
      montantAssiette,
      modePaiement,
      observations,
      creeParId: req.utilisateur ? req.utilisateur.id : null,
    });
    res.status(201).json(recu);
  } catch (e) {
    next(e);
  }
});

// Valider le reçu et déclencher l'envoi par email au client (Action Notaire)
router.post("/:id/valider-et-envoyer", async (req, res, next) => {
  try {
    const estNotaireOuAdmin =
      req.utilisateur &&
      (req.utilisateur.role === "notaire" ||
        req.utilisateur.role === "superadmin" ||
        req.utilisateur.role === "premier_clerc");
    if (!estNotaireOuAdmin) {
      return res
        .status(403)
        .json({
          erreur:
            "Seul le Notaire Titulaire ou le Premier Clerc peut valider et émettre officiellement les quittances au client.",
        });
    }
    const resultat = await recusService.validerEtEnvoyerRecuClient(
      req.params.id,
      req.utilisateur,
    );
    res.json(resultat);
  } catch (e) {
    next(e);
  }
});

// Joindre le scan du reçu émargé / signé (Action Secrétariat / Assistante)
router.post("/:id/joindre-scan", async (req, res, next) => {
  try {
    const { urlScan, nomFichier } = req.body || {};
    if (!urlScan)
      return res.status(400).json({ erreur: "Fichier scanné manquant." });
    const recu = await recusService.joindreScanRecu(req.params.id, {
      urlScan,
      nomFichier,
      utilisateurId: req.utilisateur.id,
    });
    res.json(recu);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
