/**
 * src/api/fiscal.routes.js — Calcul, historique et circuit de validation des fiches de taxe.
 *
 * Cycle de validation :
 *   1. Comptable/Clerc prépare et clique sur "Soumettre au Notaire" (statut: 'soumis')
 *   2. Le Notaire examine la fiche de taxe et peut :
 *      - Valider directement (statut: 'valide')
 *      - Corriger directement et valider (statut: 'valide_corrige')
 *      - Renvoyer avec observations au comptable (statut: 'a_corriger')
 */

const express = require("express");
const { exigerPermission } = require("../middleware/exigerPermission");
const { pool } = require("../db/pool");
const fiscalService = require("../services/fiscal.service");
const referentielService = require("../services/referentiel.service");
const parametresService = require("../services/parametres.service");

const router = express.Router();

async function calculerPourTypeActe(typeActeId, montant, saisies) {
  const typeActe = await referentielService.obtenirTypeActe(typeActeId);
  if (!typeActe) return null;
  const [parametres, tranches] = await Promise.all([
    parametresService.obtenir(),
    referentielService.obtenirTranchesBareme(typeActe.baremeEmolumentsId),
  ]);
  return fiscalService.calculerFicheDeTaxe(typeActe, montant, parametres, tranches, saisies);
}

// Catalogue des lignes et formalités sélectionnables
router.get("/catalogue-lignes", async (req, res, next) => {
  try {
    const { typeActeId, montant } = req.query || {};
    let typeActe = {};
    if (typeActeId) {
      typeActe = (await referentielService.obtenirTypeActe(typeActeId)) || {};
    }
    const catalogue = fiscalService.obtenirCatalogueLignesStandard(typeActe, Number(montant) || 0);
    res.json(catalogue);
  } catch (e) { next(e); }
});

// Calcul temps réel de la fiche de taxe (Aperçu)
router.post("/calculer", exigerPermission("fiscal:calculer"), async (req, res, next) => {
  try {
    const { typeActeId, montant, saisies } = req.body || {};
    const fiche = await calculerPourTypeActe(typeActeId, montant, saisies);
    if (!fiche) return res.status(404).json({ erreur: "Type d'acte introuvable." });
    res.json(fiche);
  } catch (e) { next(e); }
});

// Enregistrer une fiche de taxe (Brouillon, Soumise ou Validée)
router.post("/dossiers/:dossierId/enregistrer", exigerPermission("fiscal:enregistrer_fiche_taxe"), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM dossiers WHERE id = $1", [req.params.dossierId]);
    if (!rows.length) return res.status(404).json({ erreur: "Dossier introuvable." });
    const dossier = rows[0];

    const typeActeId = req.body.typeActeId || dossier.type_acte_id;
    const montant = req.body.montant !== undefined ? Number(req.body.montant) : Number(dossier.montant_assiette);
    const statutDemande = req.body.statut || "brouillon"; // 'brouillon', 'soumis', 'valide'
    const commentaire = req.body.commentaire || null;

    if (req.body.typeActeId || req.body.montant !== undefined) {
      await pool.query("UPDATE dossiers SET type_acte_id = $1, montant_assiette = $2 WHERE id = $3", [typeActeId, montant, dossier.id]);
    }

    const fiche = await calculerPourTypeActe(typeActeId, montant, req.body.saisies);
    if (!fiche) return res.status(404).json({ erreur: "Type d'acte introuvable." });

    const estNotaire = req.utilisateur.role === "notaire" || req.utilisateur.role === "superadmin";
    const statutFinal = (estNotaire && statutDemande === "valide") ? "valide" : (statutDemande === "soumis" ? "soumis" : "brouillon");
    const validePar = statutFinal === "valide" ? req.utilisateur.id : null;
    const valideLe = statutFinal === "valide" ? new Date() : null;

    const inseree = await pool.query(
      `INSERT INTO fiches_taxe 
        (dossier_id, donnees, utilisateur_id, statut, commentaire_notaire, valide_par_id, valide_le) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [dossier.id, fiche, req.utilisateur.id, statutFinal, commentaire, validePar, valideLe]
    );

    // Si soumission au notaire, notifier les notaires de l'étude
    if (statutFinal === "soumis") {
      const notaires = await pool.query("SELECT id FROM utilisateurs WHERE role = 'notaire' OR role = 'premier_clerc'");
      for (const notaire of notaires.rows) {
        await pool.query(
          `INSERT INTO notifications (utilisateur_id, titre, corps, priorite, created_at)
           VALUES ($1, $2, $3, 'haute', now())`,
          [
            notaire.id,
            `📑 Fiche de taxe à valider — Dossier ${dossier.numero_dossier}`,
            `Le comptable ${req.utilisateur.nom_complet || ""} a soumis la fiche de taxe du dossier ${dossier.numero_dossier} pour visa. Total : ${fiscalService.formaterFCFA ? fiscalService.formaterFCFA(fiche.totaux.general) : fiche.totaux.general + ' FCFA'}.`
          ]
        );
      }
    }

    res.status(201).json(inseree.rows[0]);
  } catch (e) { next(e); }
});

// Soumettre une fiche de taxe existante au Notaire
router.post("/fiches/:ficheId/soumettre", exigerPermission("fiscal:enregistrer_fiche_taxe"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, d.numero_dossier 
       FROM fiches_taxe f
       JOIN dossiers d ON d.id = f.dossier_id
       WHERE f.id = $1`,
      [req.params.ficheId]
    );
    if (!rows.length) return res.status(404).json({ erreur: "Fiche de taxe introuvable." });
    const fiche = rows[0];

    const misAJour = await pool.query(
      `UPDATE fiches_taxe 
       SET statut = 'soumis', created_at = now()
       WHERE id = $1 
       RETURNING *`,
      [fiche.id]
    );

    // Notifier le Notaire
    const notaires = await pool.query("SELECT id FROM utilisateurs WHERE role = 'notaire' OR role = 'premier_clerc'");
    for (const notaire of notaires.rows) {
      await pool.query(
        `INSERT INTO notifications (utilisateur_id, titre, corps, priorite, created_at)
         VALUES ($1, $2, $3, 'haute', now())`,
        [
          notaire.id,
          `📑 Fiche de taxe soumise pour visa — ${fiche.numero_dossier}`,
          `La fiche de taxe du dossier ${fiche.numero_dossier} a été soumise par ${req.utilisateur.nom_complet || "le comptable"}.`
        ]
      );
    }

    res.json(misAJour.rows[0]);
  } catch (e) { next(e); }
});

// Valider directement la Fiche de Taxe (Par le Notaire)
router.post("/fiches/:ficheId/valider", async (req, res, next) => {
  try {
    if (req.utilisateur.role !== "notaire" && req.utilisateur.role !== "premier_clerc" && req.utilisateur.role !== "superadmin") {
      return res.status(403).json({ erreur: "Seul le Notaire ou le Premier Clerc peut valider officiellement une fiche de taxe." });
    }

    const { rows } = await pool.query(
      `SELECT f.*, d.numero_dossier 
       FROM fiches_taxe f
       JOIN dossiers d ON d.id = f.dossier_id
       WHERE f.id = $1`,
      [req.params.ficheId]
    );
    if (!rows.length) return res.status(404).json({ erreur: "Fiche de taxe introuvable." });
    const fiche = rows[0];

    const validee = await pool.query(
      `UPDATE fiches_taxe 
       SET statut = 'valide', 
           valide_par_id = $1, 
           valide_le = now(),
           commentaire_notaire = NULL
       WHERE id = $2 
       RETURNING *`,
      [req.utilisateur.id, fiche.id]
    );

    // Notifier l'auteur comptable
    if (fiche.utilisateur_id && fiche.utilisateur_id !== req.utilisateur.id) {
      await pool.query(
        `INSERT INTO notifications (utilisateur_id, titre, corps, priorite, created_at)
         VALUES ($1, $2, $3, 'normale', now())`,
        [
          fiche.utilisateur_id,
          `✅ Fiche de taxe validée — ${fiche.numero_dossier}`,
          `Maître ${req.utilisateur.nom_complet} a validé la fiche de taxe du dossier ${fiche.numero_dossier}. La note de frais client peut être émise.`
        ]
      );
    }

    res.json(validee.rows[0]);
  } catch (e) { next(e); }
});

// Corriger et Valider directement la Fiche de Taxe (Par le Notaire)
router.post("/fiches/:ficheId/corriger-valider", async (req, res, next) => {
  try {
    if (req.utilisateur.role !== "notaire" && req.utilisateur.role !== "premier_clerc" && req.utilisateur.role !== "superadmin") {
      return res.status(403).json({ erreur: "Seul le Notaire peut corriger et valider une fiche de taxe." });
    }

    const { rows } = await pool.query(
      `SELECT f.*, d.numero_dossier, d.type_acte_id, d.montant_assiette 
       FROM fiches_taxe f
       JOIN dossiers d ON d.id = f.dossier_id
       WHERE f.id = $1`,
      [req.params.ficheId]
    );
    if (!rows.length) return res.status(404).json({ erreur: "Fiche de taxe introuvable." });
    const fiche = rows[0];

    const typeActeId = req.body.typeActeId || fiche.type_acte_id;
    const montant = req.body.montant !== undefined ? Number(req.body.montant) : Number(fiche.montant_assiette);
    const saisiesNouvelles = req.body.saisies || {};
    const commentaireNotaire = req.body.commentaire || "Ajusté et validé par le Notaire";

    const nouvelleDonnees = await calculerPourTypeActe(typeActeId, montant, saisiesNouvelles);
    if (!nouvelleDonnees) return res.status(404).json({ erreur: "Erreur de recalcul fiscal." });

    const miseAJour = await pool.query(
      `UPDATE fiches_taxe 
       SET donnees = $1,
           statut = 'valide_corrige',
           commentaire_notaire = $2,
           valide_par_id = $3,
           valide_le = now(),
           modifications_notaire = $4,
           version = version + 1
       WHERE id = $5 
       RETURNING *`,
      [
        nouvelleDonnees,
        commentaireNotaire,
        req.utilisateur.id,
        JSON.stringify({ date: new Date(), auteur: req.utilisateur.nom_complet, saisies: saisiesNouvelles }),
        fiche.id
      ]
    );

    // Notifier l'auteur comptable
    if (fiche.utilisateur_id && fiche.utilisateur_id !== req.utilisateur.id) {
      await pool.query(
        `INSERT INTO notifications (utilisateur_id, titre, corps, priorite, created_at)
         VALUES ($1, $2, $3, 'normale', now())`,
        [
          fiche.utilisateur_id,
          `✏️ Fiche de taxe corrigée & validée — ${fiche.numero_dossier}`,
          `Maître ${req.utilisateur.nom_complet} a apporté des corrections et validé la fiche de taxe du dossier ${fiche.numero_dossier}. Note : « ${commentaireNotaire} »`
        ]
      );
    }

    res.json(miseAJour.rows[0]);
  } catch (e) { next(e); }
});

// Renvoyer la Fiche de Taxe pour Correction (Par le Notaire)
router.post("/fiches/:ficheId/renvoyer", async (req, res, next) => {
  try {
    if (req.utilisateur.role !== "notaire" && req.utilisateur.role !== "premier_clerc" && req.utilisateur.role !== "superadmin") {
      return res.status(403).json({ erreur: "Seul le Notaire ou le Premier Clerc peut renvoyer une fiche de taxe pour correction." });
    }

    const { commentaire } = req.body || {};
    if (!commentaire || !commentaire.trim()) {
      return res.status(400).json({ erreur: "Veuillez préciser vos observations ou remarques pour le comptable." });
    }

    const { rows } = await pool.query(
      `SELECT f.*, d.numero_dossier 
       FROM fiches_taxe f
       JOIN dossiers d ON d.id = f.dossier_id
       WHERE f.id = $1`,
      [req.params.ficheId]
    );
    if (!rows.length) return res.status(404).json({ erreur: "Fiche de taxe introuvable." });
    const fiche = rows[0];

    const renvoyee = await pool.query(
      `UPDATE fiches_taxe 
       SET statut = 'a_corriger',
           commentaire_notaire = $1
       WHERE id = $2 
       RETURNING *`,
      [commentaire.trim(), fiche.id]
    );

    // Notifier l'auteur comptable
    if (fiche.utilisateur_id) {
      await pool.query(
        `INSERT INTO notifications (utilisateur_id, titre, corps, priorite, created_at)
         VALUES ($1, $2, $3, 'haute', now())`,
        [
          fiche.utilisateur_id,
          `⚠️ Fiche de taxe à corriger — ${fiche.numero_dossier}`,
          `Maître ${req.utilisateur.nom_complet} a renvoyé la fiche de taxe du dossier ${fiche.numero_dossier} pour correction. Remarques : « ${commentaire.trim()} »`
        ]
      );
    }

    res.json(renvoyee.rows[0]);
  } catch (e) { next(e); }
});

// Fiches de taxe en attente de visa du notaire
router.get("/fiches-en-attente", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.id, f.dossier_id, f.donnees, f.statut, f.commentaire_notaire, f.created_at, f.version,
             d.numero_dossier, d.type_acte_id, d.montant_assiette,
             u.nom_complet AS utilisateur_nom,
             COALESCE((
               SELECT string_agg(c.nom, ', ')
               FROM dossier_comparants c
               WHERE c.dossier_id = d.id
             ), '') AS comparants_noms
      FROM fiches_taxe f
      JOIN dossiers d ON d.id = f.dossier_id
      LEFT JOIN utilisateurs u ON u.id = f.utilisateur_id
      WHERE f.statut = 'soumis'
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// Historique d'un dossier
router.get("/dossiers/:dossierId/historique", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, u.nom_complet AS utilisateur_nom, v.nom_complet AS valideur_nom
       FROM fiches_taxe f
       LEFT JOIN utilisateurs u ON u.id = f.utilisateur_id
       LEFT JOIN utilisateurs v ON v.id = f.valide_par_id
       WHERE f.dossier_id = $1 
       ORDER BY f.created_at DESC`,
      [req.params.dossierId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Toutes les fiches avec enrichissement de statut
router.get("/toutes-fiches", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.id, f.dossier_id, f.donnees, f.statut, f.commentaire_notaire, f.valide_le, f.version, f.created_at,
             d.numero_dossier, d.type_acte_id, d.montant_assiette,
             u.nom_complet AS utilisateur_nom,
             v.nom_complet AS valideur_nom,
             COALESCE((
               SELECT string_agg(c.nom, ', ')
               FROM dossier_comparants c
               WHERE c.dossier_id = d.id
             ), '') AS comparants_noms
      FROM fiches_taxe f
      JOIN dossiers d ON d.id = f.dossier_id
      LEFT JOIN utilisateurs u ON u.id = f.utilisateur_id
      LEFT JOIN utilisateurs v ON v.id = f.valide_par_id
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
