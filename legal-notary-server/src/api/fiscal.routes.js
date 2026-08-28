/**
 * src/api/fiscal.routes.js — Calcul et historique des fiches de taxe.
 *
 * Le calcul lui-même (POST /calculer) est un aperçu : il ne touche pas la
 * base de données, il renvoie juste le résultat du moteur fiscal pour que
 * le comptable puisse ajuster les saisies avant de valider. Seul
 * POST /dossiers/:id/enregistrer écrit réellement une ligne dans
 * `fiches_taxe` (historique, jamais écrasé — voir migration).
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

router.post("/calculer", exigerPermission("fiscal:calculer"), async (req, res, next) => {
  try {
    const { typeActeId, montant, saisies } = req.body || {};
    const fiche = await calculerPourTypeActe(typeActeId, montant, saisies);
    if (!fiche) return res.status(404).json({ erreur: "Type d'acte introuvable." });
    res.json(fiche);
  } catch (e) { next(e); }
});

router.post("/dossiers/:dossierId/enregistrer", exigerPermission("fiscal:enregistrer_fiche_taxe"), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM dossiers WHERE id = $1", [req.params.dossierId]);
    if (!rows.length) return res.status(404).json({ erreur: "Dossier introuvable." });
    const dossier = rows[0];

    const fiche = await calculerPourTypeActe(dossier.type_acte_id, Number(dossier.montant_assiette), req.body.saisies);
    if (!fiche) return res.status(404).json({ erreur: "Type d'acte introuvable." });

    const inseree = await pool.query(
      "INSERT INTO fiches_taxe (dossier_id, donnees, utilisateur_id) VALUES ($1, $2, $3) RETURNING *",
      [dossier.id, fiche, req.utilisateur.id]
    );
    res.status(201).json(inseree.rows[0]);
  } catch (e) { next(e); }
});

router.get("/dossiers/:dossierId/historique", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM fiches_taxe WHERE dossier_id = $1 ORDER BY created_at DESC",
      [req.params.dossierId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
