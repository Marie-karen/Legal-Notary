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
const fs = require("fs");
const path = require("path");

function versCamel(l) {
  return {
    id: Number(l.id),
    code: l.code,
    libelle: l.libelle,
    description: l.description || "",
    roleResponsable: l.role_responsable || l.roleResponsable || "clerc_redacteur",
    niveauAlerteParDefaut: l.niveau_alerte_par_defaut || l.niveauAlerteParDefaut || "normal",
  };
}

const ETAPES_INITIALES = [
  {
    id: 1,
    code: "COLLECTE_KYC",
    libelle: "Collecte & KYC",
    description: "Vérification CNI/passeport, extrait < 3 mois, livret de famille / KYC personne morale.",
    roleResponsable: "assistante",
    niveauAlerteParDefaut: "normal",
  },
  {
    id: 2,
    code: "REQUISITIONS",
    libelle: "Réquisitions & états préalables",
    description: "Conservation Foncière, TCA, certificat d'urbanisme, RCCM.",
    roleResponsable: "clerc_redacteur",
    niveauAlerteParDefaut: "normal",
  },
  {
    id: 3,
    code: "REDACTION",
    libelle: "Rédaction du projet d'acte",
    description: "Rédaction de la minute, insertion des clauses, contrôle notarial de légalité.",
    roleResponsable: "clerc_redacteur",
    niveauAlerteParDefaut: "eleve",
  },
  {
    id: 4,
    code: "SIGNATURE",
    libelle: "Rendez-vous de signature",
    description: "Lecture de l'acte, recueil des signatures des comparants et du Notaire Titulaire.",
    roleResponsable: "notaire",
    niveauAlerteParDefaut: "eleve",
  },
  {
    id: 5,
    code: "FORMALITES",
    libelle: "Formalités DGI & Conservation Foncière",
    description: "Enregistrement fiscal, formalité fusionnée, inscription au Livre Foncier / RCCM.",
    roleResponsable: "clerc_formaliste",
    niveauAlerteParDefaut: "critique",
  },
  {
    id: 6,
    code: "EXPEDITIONS",
    libelle: "Expéditions & archivage",
    description: "Délivrance des grosses et expéditions, entrée au minutier, numérotation et archivage.",
    roleResponsable: "archiviste",
    niveauAlerteParDefaut: "normal",
  },
];

const MEMOIRE_ETAPES = new Map(ETAPES_INITIALES.map((e) => [e.id, { ...e }]));

// Persistance fichier locale
const FICHIER_ETAPES_JSON = path.join(__dirname, "..", "data", "manuel_etapes.json");
try {
  if (fs.existsSync(FICHIER_ETAPES_JSON)) {
    const data = JSON.parse(fs.readFileSync(FICHIER_ETAPES_JSON, "utf8"));
    if (Array.isArray(data)) {
      data.forEach((e) => {
        if (e && e.id) MEMOIRE_ETAPES.set(Number(e.id), { ...e });
      });
    }
  }
} catch (_) {}

function sauvegarderSurDisque() {
  try {
    const dir = path.dirname(FICHIER_ETAPES_JSON);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FICHIER_ETAPES_JSON, JSON.stringify(Array.from(MEMOIRE_ETAPES.values()), null, 2));
  } catch (_) {}
}

async function listerEtapes() {
  try {
    const { rows } = await pool.query("SELECT * FROM etapes_pipeline ORDER BY id");
    if (rows && rows.length) {
      const etapes = rows.map(versCamel);
      etapes.forEach((e) => MEMOIRE_ETAPES.set(e.id, e));
      return etapes;
    }
  } catch (_) {}

  return Array.from(MEMOIRE_ETAPES.values()).sort((a, b) => a.id - b.id);
}

async function obtenirEtape(id) {
  const idNum = Number(id);
  try {
    const { rows } = await pool.query("SELECT * FROM etapes_pipeline WHERE id = $1", [idNum]);
    if (rows && rows.length) return versCamel(rows[0]);
  } catch (_) {}

  return MEMOIRE_ETAPES.get(idNum) || null;
}

async function modifierEtape(id, { description, roleResponsable, niveauAlerteParDefaut }) {
  const idNum = Number(id);
  let etapeModifiee = null;

  try {
    const { rows } = await pool.query(
      `UPDATE etapes_pipeline SET
         description = COALESCE($1, description),
         role_responsable = COALESCE($2, role_responsable),
         niveau_alerte_par_defaut = COALESCE($3, niveau_alerte_par_defaut)
       WHERE id = $4 RETURNING *`,
      [description, roleResponsable, niveauAlerteParDefaut, idNum]
    );
    if (rows && rows.length) etapeModifiee = versCamel(rows[0]);
  } catch (_) {}

  const existante = MEMOIRE_ETAPES.get(idNum) ||
    ETAPES_INITIALES.find((e) => e.id === idNum) || {
      id: idNum,
      code: `ETAPE_${idNum}`,
      libelle: `Étape ${idNum}`,
    };
  const maj = {
    ...existante,
    description: description !== undefined ? description : existante.description,
    roleResponsable: roleResponsable !== undefined ? roleResponsable : existante.roleResponsable,
    niveauAlerteParDefaut:
      niveauAlerteParDefaut !== undefined ? niveauAlerteParDefaut : existante.niveauAlerteParDefaut,
  };
  MEMOIRE_ETAPES.set(idNum, maj);
  sauvegarderSurDisque();

  return etapeModifiee || maj;
}

module.exports = {
  listerEtapes,
  obtenirEtape,
  modifierEtape,
  ETAPES_INITIALES,
};
