/**
 * src/services/manuel-procedure.service.js — Manuel de procédure du pipeline.
 *
 * Demande explicite du 2026-08-25 : « un paramètre sur le manuel de
 * procédure... qui fait quoi, les différentes étapes et niveaux d'alerte ».
 * Les 6 étapes du pipeline (voir migration 002, table `etapes_pipeline`)
 * étaient jusque-là une liste fixe dans le code — elles vivent maintenant
 * en base : le cabinet peut décrire/corriger qui est responsable de
 * chaque étape et son niveau d'alerte sans reprise de développement.
 *
 * Ce qui reste structurel (non éditable, car c'est la mécanique même du
 * pipeline) : le nombre d'étapes (toujours 6), leur ordre (id 1 à 6), et
 * leur `code` (utilisé ailleurs dans le code, ex. alertes.service.js).
 * Ce qui est éditable : `description`, `role_responsable`,
 * `niveau_alerte_par_defaut`.
 */

const { pool } = require("../db/pool");

function versCamel(l) {
  return {
    id: l.id,
    code: l.code,
    libelle: l.libelle,
    description: l.description,
    roleResponsable: l.role_responsable,
    niveauAlerteParDefaut: l.niveau_alerte_par_defaut,
  };
}

async function listerEtapes() {
  const { rows } = await pool.query("SELECT * FROM etapes_pipeline ORDER BY id");
  return rows.map(versCamel);
}

async function obtenirEtape(id) {
  const { rows } = await pool.query("SELECT * FROM etapes_pipeline WHERE id = $1", [id]);
  return rows.length ? versCamel(rows[0]) : null;
}

async function modifierEtape(id, { description, roleResponsable, niveauAlerteParDefaut }) {
  const { rows } = await pool.query(
    `UPDATE etapes_pipeline SET
       description = COALESCE($1, description),
       role_responsable = COALESCE($2, role_responsable),
       niveau_alerte_par_defaut = COALESCE($3, niveau_alerte_par_defaut)
     WHERE id = $4 RETURNING *`,
    [description, roleResponsable, niveauAlerteParDefaut, id]
  );
  return rows.length ? versCamel(rows[0]) : null;
}

module.exports = { listerEtapes, obtenirEtape, modifierEtape };
