/**
 * src/services/referentiel.service.js — Catalogue des actes & checklist.
 *
 * Le catalogue (classifications, types d'actes, tâches standard, barèmes
 * d'émoluments) est importé une première fois depuis la pratique réelle du
 * cabinet (voir seed/etude1_catalogue.json, scripts/importer-referentiel.js)
 * puis reste modifiable via l'API (permission `referentiel:gerer`, réservée
 * au notaire et au premier clerc — voir docs/RBAC.md) : ajouter un type
 * d'acte, changer la durée standard d'une tâche, corriger un droit
 * d'enregistrement une fois confirmé, etc. ne demande jamais de toucher au
 * code.
 */

const { pool } = require("../db/pool");

function typeActeVersCamel(l) {
  return {
    id: l.id,
    classificationId: l.classification_id,
    libelle: l.libelle,
    delaiStandardJours: l.delai_standard_jours,
    baremeEmolumentsId: l.bareme_emoluments_id,
    droitEnregistrementMode: l.droit_enregistrement_mode,
    droitEnregistrementValeur: Number(l.droit_enregistrement_valeur),
    taxeFonciereApplicable: l.taxe_fonciere_applicable,
    actif: l.actif,
  };
}

function tacheStandardVersCamel(l) {
  return {
    id: l.id,
    typeActeId: l.type_acte_id,
    etape: l.etape,
    ordre: l.ordre,
    libelle: l.libelle,
    dureeJours: l.duree_jours,
    bloquante: l.bloquante,
  };
}

async function listerClassifications() {
  const { rows } = await pool.query(
    "SELECT * FROM classifications_actes WHERE archived_at IS NULL ORDER BY ordre, libelle"
  );
  return rows.map((r) => ({ id: r.id, libelle: r.libelle, ordre: r.ordre }));
}

async function listerTypesActes() {
  const { rows } = await pool.query(
    "SELECT * FROM types_actes WHERE actif = true AND archived_at IS NULL ORDER BY libelle"
  );
  return rows.map(typeActeVersCamel);
}

async function obtenirTypeActe(id) {
  const { rows } = await pool.query("SELECT * FROM types_actes WHERE id = $1", [id]);
  return rows.length ? typeActeVersCamel(rows[0]) : null;
}

async function listerTachesStandard(typeActeId) {
  const { rows } = await pool.query(
    "SELECT * FROM taches_standard WHERE type_acte_id = $1 AND archived_at IS NULL ORDER BY ordre",
    [typeActeId]
  );
  return rows.map(tacheStandardVersCamel);
}

/**
 * Tranches du barème d'émoluments applicable à un type d'acte, au format
 * attendu par fiscal.service.js. Renvoie un tableau vide si le type d'acte
 * n'a pas de barème (=> le moteur fiscal applique alors le minimum légal
 * de minute uniquement, jamais un taux inventé).
 */
async function obtenirTranchesBareme(baremeEmolumentsId) {
  if (!baremeEmolumentsId) return [];
  const { rows: bRows } = await pool.query("SELECT libelle, code FROM baremes_emoluments WHERE id = $1", [baremeEmolumentsId]);
  const { rows } = await pool.query(
    "SELECT jusqua, taux FROM baremes_emoluments_tranches WHERE bareme_id = $1 ORDER BY ordre",
    [baremeEmolumentsId]
  );
  const res = rows.map((r) => ({ jusqua: r.jusqua === null ? null : Number(r.jusqua), taux: Number(r.taux) }));
  res.baremeNom = bRows.length ? bRows[0].libelle : null;
  res.baremeCode = bRows.length ? bRows[0].code : null;
  return res;
}

/**
 * Met à jour la durée standard (en jours) d'une tâche du référentiel —
 * c'est LE point d'entrée pour adapter les délais à la pratique du
 * cabinet (règle : "la durée d'une tâche dépend de chaque cabinet, donc
 * paramétrable"). Recalcule ensuite delai_standard_jours du type d'acte
 * parent (somme des tâches) pour que l'affichage reste cohérent.
 */
async function modifierDureeTache(tacheId, nouvelleDureeJours) {
  const { rows } = await pool.query(
    "UPDATE taches_standard SET duree_jours = $1 WHERE id = $2 RETURNING type_acte_id",
    [nouvelleDureeJours, tacheId]
  );
  if (!rows.length) return null;
  const typeActeId = rows[0].type_acte_id;
  await pool.query(
    `UPDATE types_actes SET delai_standard_jours = (
       SELECT COALESCE(SUM(duree_jours), 0) FROM taches_standard
       WHERE type_acte_id = $1 AND archived_at IS NULL
     ) WHERE id = $1`,
    [typeActeId]
  );
  return typeActeId;
}

/**
 * Crée un nouveau type d'acte dans le catalogue avec ses étapes/tâches initiales.
 */
async function creerTypeActe(donnees) {
  const {
    classificationId,
    libelle,
    delaiStandardJours = 15,
    baremeEmolumentsId = null,
    droitEnregistrementMode = "a_confirmer",
    droitEnregistrementValeur = 0,
    taxeFonciereApplicable = false,
    taches = [],
  } = donnees;

  // Résolution robuste de la classification
  let finalClassifId = null;
  if (classificationId) {
    const { rows: classifs } = await pool.query(
      "SELECT id FROM classifications_actes WHERE id::text = $1 OR libelle ILIKE $1 LIMIT 1",
      [classificationId]
    );
    if (classifs.length) finalClassifId = classifs[0].id;
    else {
      const { rows: premier } = await pool.query("SELECT id FROM classifications_actes LIMIT 1");
      if (premier.length) finalClassifId = premier[0].id;
    }
  }

  // Résolution robuste du barème d'émoluments
  let finalBaremeId = null;
  if (baremeEmolumentsId) {
    const { rows: baremes } = await pool.query(
      "SELECT id FROM baremes_emoluments WHERE code = $1 OR id::text = $1 LIMIT 1",
      [baremeEmolumentsId]
    );
    if (baremes.length) finalBaremeId = baremes[0].id;
  }

  const { rows } = await pool.query(
    `INSERT INTO types_actes (classification_id, libelle, delai_standard_jours, bareme_emoluments_id, droit_enregistrement_mode, droit_enregistrement_valeur, taxe_fonciere_applicable, actif)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING *`,
    [finalClassifId, libelle, delaiStandardJours, finalBaremeId, droitEnregistrementMode, droitEnregistrementValeur, Boolean(taxeFonciereApplicable)]
  );

  const typeActeCree = rows[0];
  const typeActeId = typeActeCree.id;

  if (taches && taches.length) {
    for (let i = 0; i < taches.length; i++) {
      const t = taches[i];
      await pool.query(
        `INSERT INTO taches_standard (type_acte_id, etape, ordre, libelle, duree_jours, bloquante)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [typeActeId, t.etape || 1, t.ordre || (i + 1), t.libelle, t.dureeJours || 2, t.bloquante !== false]
      );
    }
    await pool.query(
      `UPDATE types_actes SET delai_standard_jours = (
         SELECT COALESCE(SUM(duree_jours), 0) FROM taches_standard
         WHERE type_acte_id = $1 AND archived_at IS NULL
       ) WHERE id = $1`,
      [typeActeId]
    );
  }

  return obtenirTypeActe(typeActeId);
}

/**
 * Ajoute une tâche / étape standard à un type d'acte du catalogue.
 */
async function ajouterTacheStandard(typeActeId, donnees) {
  const { etape = 1, ordre = 1, libelle, dureeJours = 2, bloquante = true } = donnees;
  const { rows } = await pool.query(
    `INSERT INTO taches_standard (type_acte_id, etape, ordre, libelle, duree_jours, bloquante)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [typeActeId, etape, ordre, libelle, dureeJours, bloquante]
  );
  await pool.query(
    `UPDATE types_actes SET delai_standard_jours = (
       SELECT COALESCE(SUM(duree_jours), 0) FROM taches_standard
       WHERE type_acte_id = $1 AND archived_at IS NULL
     ) WHERE id = $1`,
    [typeActeId]
  );
  return tacheStandardVersCamel(rows[0]);
}

module.exports = {
  typeActeVersCamel,
  tacheStandardVersCamel,
  listerClassifications,
  listerTypesActes,
  obtenirTypeActe,
  listerTachesStandard,
  obtenirTranchesBareme,
  modifierDureeTache,
  creerTypeActe,
  ajouterTacheStandard,
};
