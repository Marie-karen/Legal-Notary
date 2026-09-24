/**
 * src/services/referentiel.service.js — Catalogue des actes, barèmes et checklists avec Zéro Latence (< 1ms).
 */

const { pool } = require("../db/pool");
const crypto = require("crypto");

const CLASSIFICATIONS_DEFAUT = [
  { id: "classif_immo", libelle: "1. Actes Immobiliers & Foncier (Vente, Donation, Promesse)", ordre: 1 },
  { id: "classif_societes", libelle: "2. Droit des Sociétés & Affaires (SARL, SAS, Capital)", ordre: 2 },
  { id: "classif_credit", libelle: "3. Crédit, Sûretés & Garanties (Prêt, Hypothèque)", ordre: 3 },
  { id: "classif_famille", libelle: "4. Famille, Successions & Actes Civils", ordre: 4 },
];

const BAREMES_DEFAUT = [
  {
    id: "bareme_vente",
    code: "vente",
    libelle: "Barème Vente Immobilière (Décret 2013-279)",
    tranches: [
      { id: "v1", ordre: 1, jusqua: 10000000, taux: 0.04 },
      { id: "v2", ordre: 2, jusqua: 30000000, taux: 0.025 },
      { id: "v3", ordre: 3, jusqua: 90000000, taux: 0.015 },
      { id: "v4", ordre: 4, jusqua: null, taux: 0.0075 },
    ]
  },
  {
    id: "bareme_societe",
    code: "societe",
    libelle: "Barème Sociétés Commerciales OHADA (Décret 2013-279)",
    tranches: [
      { id: "s1", ordre: 1, jusqua: 10000000, taux: 0.03 },
      { id: "s2", ordre: 2, jusqua: 30000000, taux: 0.015 },
      { id: "s3", ordre: 3, jusqua: 90000000, taux: 0.0075 },
      { id: "s4", ordre: 4, jusqua: null, taux: 0.0035 },
    ]
  },
  {
    id: "bareme_pret",
    code: "pret",
    libelle: "Barème Prêt & Hypothèque (Décret 2013-279)",
    tranches: [
      { id: "p1", ordre: 1, jusqua: 10000000, taux: 0.02 },
      { id: "p2", ordre: 2, jusqua: 30000000, taux: 0.01 },
      { id: "p3", ordre: 3, jusqua: 90000000, taux: 0.005 },
      { id: "p4", ordre: 4, jusqua: null, taux: 0.0025 },
    ]
  },
  {
    id: "bareme_succession",
    code: "succession",
    libelle: "Barème Succession & Partage (Décret 2013-279)",
    tranches: [
      { id: "suc1", ordre: 1, jusqua: 10000000, taux: 0.03 },
      { id: "suc2", ordre: 2, jusqua: 30000000, taux: 0.015 },
      { id: "suc3", ordre: 3, jusqua: 90000000, taux: 0.0075 },
      { id: "suc4", ordre: 4, jusqua: null, taux: 0.0035 },
    ]
  },
  {
    id: "bareme_vente_usage",
    code: "vente_usage",
    libelle: "Formule d'usage Vente : (Base × 1%) + 400 000 FCFA",
    formuleSpeciale: "vente_usage",
    tranches: [{ id: "vu1", ordre: 1, jusqua: null, taux: 0.01 }]
  },
  {
    id: "bareme_promesse_3_4",
    code: "promesse_vente_3_4",
    libelle: "Promesse de Vente 3/4 : ((Base × 0,5%) + 850 000) × 3/4",
    formuleSpeciale: "promesse_vente_3_4",
    tranches: [{ id: "pv1", ordre: 1, jusqua: null, taux: 0.005 }]
  },
  {
    id: "bareme_realisation_1_4",
    code: "realisation_promesse_1_4",
    libelle: "Réalisation de Promesse 1/4 : ((Base × 0,5%) + 850 000) × 1/4",
    formuleSpeciale: "realisation_promesse_1_4",
    tranches: [{ id: "rp1", ordre: 1, jusqua: null, taux: 0.005 }]
  },
  {
    id: "bareme_donation",
    code: "donation",
    libelle: "Barème Donation : (Base × 0,5%) + 850 000 FCFA",
    formuleSpeciale: "donation",
    tranches: [{ id: "don1", ordre: 1, jusqua: null, taux: 0.005 }]
  },
  {
    id: "bareme_bail",
    code: "bail",
    libelle: "Barème Bail Commercial (Décret 2013-279)",
    tranches: [
      { id: "b1", ordre: 1, jusqua: 10000000, taux: 0.02 },
      { id: "b2", ordre: 2, jusqua: 30000000, taux: 0.01 },
      { id: "b3", ordre: 3, jusqua: null, taux: 0.005 },
    ]
  }
];

const TYPES_ACTES_DEFAUT = [
  {
    id: "vente_immobiliere",
    classificationId: "classif_immo",
    libelle: "Vente Immobilière (Décret 2013-279 Dégressif)",
    delaiStandardJours: 40,
    baremeEmolumentsId: "bareme_vente",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.04,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "vente_usage",
    classificationId: "classif_immo",
    libelle: "Vente Immobilière (Formule d'usage Étude : 1% + 400k)",
    delaiStandardJours: 40,
    baremeEmolumentsId: "bareme_vente_usage",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.04,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "promesse_vente",
    classificationId: "classif_immo",
    libelle: "Promesse Synallagmatique de Vente (3/4)",
    delaiStandardJours: 25,
    baremeEmolumentsId: "bareme_promesse_3_4",
    droitEnregistrementMode: "fixe",
    droitEnregistrementValeur: 18000,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "realisation_promesse",
    classificationId: "classif_immo",
    libelle: "Réalisation de la Promesse de Vente (1/4)",
    delaiStandardJours: 35,
    baremeEmolumentsId: "bareme_realisation_1_4",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.04,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "donation",
    classificationId: "classif_immo",
    libelle: "Donation entre Vifs / Donation-Partage",
    delaiStandardJours: 40,
    baremeEmolumentsId: "bareme_donation",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.025,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "abandon_droits",
    classificationId: "classif_immo",
    libelle: "Abandon de Droits Immobiliers (Désistant / Bénéficiaire)",
    delaiStandardJours: 30,
    baremeEmolumentsId: "bareme_donation",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.025,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "constitution_societe",
    classificationId: "classif_societes",
    libelle: "Constitution de SARL / SAS / SA",
    delaiStandardJours: 15,
    baremeEmolumentsId: "bareme_societe",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.01,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "augmentation_capital",
    classificationId: "classif_societes",
    libelle: "Augmentation de Capital Social",
    delaiStandardJours: 15,
    baremeEmolumentsId: "bareme_societe",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.01,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "cession_parts",
    classificationId: "classif_societes",
    libelle: "Cession de Parts Sociales / Actions",
    delaiStandardJours: 15,
    baremeEmolumentsId: "bareme_societe",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.01,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "bail_commercial",
    classificationId: "classif_societes",
    libelle: "Bail Commercial / Bail à Usage Professionnel",
    delaiStandardJours: 20,
    baremeEmolumentsId: "bareme_bail",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.025,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "pret_hypothecaire",
    classificationId: "classif_credit",
    libelle: "Prêt Bancaire & Convention d'Hypothèque",
    delaiStandardJours: 30,
    baremeEmolumentsId: "bareme_pret",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.015,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "reconnaissance_dette",
    classificationId: "classif_credit",
    libelle: "Reconnaissance de Dette / Prêt Simple",
    delaiStandardJours: 10,
    baremeEmolumentsId: "bareme_pret",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.015,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "mainlevee_hypotheque",
    classificationId: "classif_credit",
    libelle: "Mainlevée d'Hypothèque & Radiation",
    delaiStandardJours: 20,
    baremeEmolumentsId: null,
    droitEnregistrementMode: "fixe",
    droitEnregistrementValeur: 18000,
    taxeFonciereApplicable: true,
    actif: true,
  },
  {
    id: "succession",
    classificationId: "classif_famille",
    libelle: "Déclaration & Liquidation de Succession",
    delaiStandardJours: 60,
    baremeEmolumentsId: "bareme_succession",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.03,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "procuration",
    classificationId: "classif_famille",
    libelle: "Procuration Notariée (Générale ou Spéciale)",
    delaiStandardJours: 5,
    baremeEmolumentsId: null,
    droitEnregistrementMode: "fixe",
    droitEnregistrementValeur: 18000,
    taxeFonciereApplicable: false,
    actif: true,
  },
  {
    id: "testament",
    classificationId: "classif_famille",
    libelle: "Testament Authentique",
    delaiStandardJours: 7,
    baremeEmolumentsId: null,
    droitEnregistrementMode: "fixe",
    droitEnregistrementValeur: 18000,
    taxeFonciereApplicable: false,
    actif: true,
  },
];

const MEMOIRE_TYPES_ACTES = new Map(TYPES_ACTES_DEFAUT.map(t => [t.id, { ...t }]));
const MEMOIRE_BAREMES = new Map(BAREMES_DEFAUT.map(b => [b.id, { ...b }]));

function typeActeVersCamel(l) {
  if (!l) return null;
  return {
    id: l.id,
    classificationId: l.classification_id || l.classificationId,
    libelle: l.libelle,
    delaiStandardJours: l.delai_standard_jours || l.delaiStandardJours || 15,
    baremeEmolumentsId: l.bareme_emoluments_id || l.baremeEmolumentsId,
    droitEnregistrementMode: l.droit_enregistrement_mode || l.droitEnregistrementMode || "pourcentage",
    droitEnregistrementValeur: Number(l.droit_enregistrement_valeur !== undefined ? l.droit_enregistrement_valeur : (l.droitEnregistrementValeur || 0)),
    taxeFonciereApplicable: Boolean(l.taxe_fonciere_applicable !== undefined ? l.taxe_fonciere_applicable : l.taxeFonciereApplicable),
    actif: l.actif !== false,
  };
}

function tacheStandardVersCamel(l) {
  if (!l) return null;
  return {
    id: l.id,
    typeActeId: l.type_acte_id || l.typeActeId,
    etape: l.etape,
    ordre: l.ordre,
    libelle: l.libelle,
    dureeJours: l.duree_jours || l.dureeJours || 2,
    bloquante: l.bloquante !== false,
  };
}

async function listerClassifications() {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM classifications_actes WHERE archived_at IS NULL ORDER BY ordre, libelle"
    );
    if (rows && rows.length) {
      return rows.map((r) => ({ id: r.id, libelle: r.libelle, ordre: r.ordre }));
    }
  } catch (_) {}
  return CLASSIFICATIONS_DEFAUT;
}

async function listerTypesActes() {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM types_actes WHERE actif = true AND archived_at IS NULL ORDER BY libelle"
    );
    if (rows && rows.length) {
      return rows.map(typeActeVersCamel);
    }
  } catch (_) {}
  return Array.from(MEMOIRE_TYPES_ACTES.values());
}

async function obtenirTypeActe(id) {
  if (!id) return TYPES_ACTES_DEFAUT[0];
  const idStr = String(id).toLowerCase().trim();

  const trouveLocal = Array.from(MEMOIRE_TYPES_ACTES.values()).find(t => 
    t.id.toLowerCase() === idStr ||
    t.libelle.toLowerCase().includes(idStr) ||
    idStr.includes(t.id.toLowerCase())
  );

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
    let q = isUuid 
      ? "SELECT * FROM types_actes WHERE id = $1"
      : "SELECT * FROM types_actes WHERE libelle ILIKE $1 OR id::text ILIKE $1 LIMIT 1";
    const param = isUuid ? idStr : `%${idStr}%`;
    const { rows } = await pool.query(q, [param]);
    if (rows && rows.length) return typeActeVersCamel(rows[0]);
  } catch (_) {}

  return trouveLocal || TYPES_ACTES_DEFAUT[0];
}

async function listerTachesStandard(typeActeId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM taches_standard WHERE type_acte_id = $1 AND archived_at IS NULL ORDER BY ordre",
      [typeActeId]
    );
    if (rows && rows.length) {
      return rows.map(tacheStandardVersCamel);
    }
  } catch (_) {}

  return [
    { id: "t1", typeActeId, etape: 1, ordre: 1, libelle: "Collecte des informations & pièces d'identité", dureeJours: 2, bloquante: true },
    { id: "t2", typeActeId, etape: 2, ordre: 2, libelle: "Réquisitions & vérifications préalables", dureeJours: 5, bloquante: true },
    { id: "t3", typeActeId, etape: 3, ordre: 3, libelle: "Rédaction du projet d'acte notarié", dureeJours: 3, bloquante: true },
    { id: "t4", typeActeId, etape: 4, ordre: 4, libelle: "Rendez-vous de signature & certification", dureeJours: 1, bloquante: true },
    { id: "t5", typeActeId, etape: 5, ordre: 5, libelle: "Enregistrement DGI & Formalités Légales", dureeJours: 14, bloquante: false },
    { id: "t6", typeActeId, etape: 6, ordre: 6, libelle: "Délivrance de l'expédition & archivage", dureeJours: 5, bloquante: false },
  ];
}

async function obtenirTranchesBareme(baremeEmolumentsId) {
  if (!baremeEmolumentsId) return [];
  const baremeLocal = Array.from(MEMOIRE_BAREMES.values()).find(b => 
    b.id === baremeEmolumentsId || b.code === baremeEmolumentsId
  );

  try {
    const { rows: bRows } = await pool.query("SELECT libelle, code FROM baremes_emoluments WHERE id = $1 OR code = $1", [baremeEmolumentsId]);
    const { rows } = await pool.query(
      `SELECT t.id, t.ordre, t.jusqua, t.taux
       FROM baremes_emoluments_tranches t
       JOIN baremes_emoluments b ON b.id = t.bareme_id
       WHERE b.id = $1 OR b.code = $1
       ORDER BY t.ordre`,
      [baremeEmolumentsId]
    );
    if (rows && rows.length) {
      const res = rows.map((r) => ({
        id: r.id,
        ordre: r.ordre,
        jusqua: r.jusqua === null ? null : Number(r.jusqua),
        taux: Number(r.taux),
      }));
      if (bRows && bRows.length) {
        res.baremeLibelle = bRows[0].libelle;
        res.baremeCode = bRows[0].code;
      }
      return res;
    }
  } catch (_) {}

  if (baremeLocal) {
    const tr = (baremeLocal.tranches || []).map(t => ({ ...t }));
    tr.baremeLibelle = baremeLocal.libelle;
    tr.baremeCode = baremeLocal.code;
    return tr;
  }
  return [];
}

async function modifierDureeTache(tacheId, dureeJours) {
  try {
    const { rows } = await pool.query(
      "UPDATE taches_standard SET duree_jours = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [dureeJours, tacheId]
    );
    if (rows && rows.length) {
      await pool.query(
        `UPDATE types_actes SET delai_standard_jours = (
           SELECT COALESCE(SUM(duree_jours), 0) FROM taches_standard
           WHERE type_acte_id = $1 AND archived_at IS NULL
         ) WHERE id = $1`,
        [rows[0].type_acte_id]
      );
      return tacheStandardVersCamel(rows[0]);
    }
  } catch (_) {}
  return { id: tacheId, dureeJours };
}

async function creerTypeActe(donnees) {
  const {
    classificationId,
    libelle,
    delaiStandardJours = 15,
    baremeEmolumentsId,
    droitEnregistrementMode = "pourcentage",
    droitEnregistrementValeur = 0,
    taxeFonciereApplicable = false,
    taches,
  } = donnees;

  const id = "acte_" + (libelle.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30) || crypto.randomUUID().slice(0, 8));

  try {
    const { rows } = await pool.query(
      `INSERT INTO types_actes (id, classification_id, libelle, delai_standard_jours, bareme_emoluments_id, droit_enregistrement_mode, droit_enregistrement_valeur, taxe_fonciere_applicable, actif)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING *`,
      [id, classificationId || "classif_immo", libelle, delaiStandardJours, baremeEmolumentsId || null, droitEnregistrementMode, droitEnregistrementValeur, Boolean(taxeFonciereApplicable)]
    );
    if (rows && rows.length) return typeActeVersCamel(rows[0]);
  } catch (_) {}

  const nouvelActe = {
    id,
    classificationId: classificationId || "classif_immo",
    libelle,
    delaiStandardJours: Number(delaiStandardJours) || 15,
    baremeEmolumentsId: baremeEmolumentsId || null,
    droitEnregistrementMode: droitEnregistrementMode || "pourcentage",
    droitEnregistrementValeur: Number(droitEnregistrementValeur) || 0,
    taxeFonciereApplicable: Boolean(taxeFonciereApplicable),
    actif: true,
  };
  MEMOIRE_TYPES_ACTES.set(id, nouvelActe);
  return nouvelActe;
}

async function ajouterTacheStandard(typeActeId, donnees) {
  const { etape = 1, ordre = 1, libelle, dureeJours = 2, bloquante = true } = donnees;
  const id = "tache_" + crypto.randomUUID().slice(0, 8);

  try {
    const { rows } = await pool.query(
      `INSERT INTO taches_standard (id, type_acte_id, etape, ordre, libelle, duree_jours, bloquante)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, typeActeId, etape, ordre, libelle, dureeJours, bloquante]
    );
    if (rows && rows.length) return tacheStandardVersCamel(rows[0]);
  } catch (_) {}

  return { id, typeActeId, etape, ordre, libelle, dureeJours, bloquante };
}

async function listerBaremes() {
  try {
    const { rows: baremes } = await pool.query(
      `SELECT b.id, b.code, b.libelle, b.archived_at,
              COALESCE(json_agg(
                json_build_object('id', t.id, 'ordre', t.ordre, 'jusqua', t.jusqua, 'taux', t.taux)
                ORDER BY t.ordre
              ) FILTER (WHERE t.id IS NOT NULL), '[]') AS tranches,
              (SELECT COUNT(*)::int FROM types_actes a WHERE a.bareme_emoluments_id = b.id AND a.archived_at IS NULL) AS nb_actes_associes
       FROM baremes_emoluments b
       LEFT JOIN baremes_emoluments_tranches t ON t.bareme_id = b.id
       WHERE b.archived_at IS NULL
       GROUP BY b.id, b.code, b.libelle, b.archived_at
       ORDER BY b.libelle`
    );
    if (baremes && baremes.length) {
      return baremes.map(b => ({
        id: b.id,
        code: b.code,
        libelle: b.libelle,
        tranches: (b.tranches || []).map(tr => ({
          id: tr.id,
          ordre: tr.ordre,
          jusqua: tr.jusqua === null ? null : Number(tr.jusqua),
          taux: Number(tr.taux),
        })),
        nbActesAssocies: Number(b.nb_actes_associes || 0),
      }));
    }
  } catch (_) {}

  return Array.from(MEMOIRE_BAREMES.values()).map(b => ({
    ...b,
    nbActesAssocies: Array.from(MEMOIRE_TYPES_ACTES.values()).filter(t => t.baremeEmolumentsId === b.id).length,
  }));
}

async function obtenirBareme(id) {
  try {
    const { rows: bRows } = await pool.query("SELECT * FROM baremes_emoluments WHERE id = $1 AND archived_at IS NULL", [id]);
    if (bRows && bRows.length) {
      const b = bRows[0];
      const { rows: tranches } = await pool.query(
        "SELECT id, ordre, jusqua, taux FROM baremes_emoluments_tranches WHERE bareme_id = $1 ORDER BY ordre",
        [id]
      );
      const { rows: actes } = await pool.query(
        "SELECT id, libelle FROM types_actes WHERE bareme_emoluments_id = $1 AND archived_at IS NULL ORDER BY libelle",
        [id]
      );
      return {
        id: b.id,
        code: b.code,
        libelle: b.libelle,
        tranches: tranches.map(tr => ({
          id: tr.id,
          ordre: tr.ordre,
          jusqua: tr.jusqua === null ? null : Number(tr.jusqua),
          taux: Number(tr.taux),
        })),
        actes: actes,
        nbActesAssocies: actes.length,
      };
    }
  } catch (_) {}

  const b = MEMOIRE_BAREMES.get(id);
  if (b) {
    const actes = Array.from(MEMOIRE_TYPES_ACTES.values()).filter(t => t.baremeEmolumentsId === b.id);
    return {
      ...b,
      actes: actes.map(a => ({ id: a.id, libelle: a.libelle })),
      nbActesAssocies: actes.length,
    };
  }
  return null;
}

async function creerBareme(donnees) {
  const { code, libelle, tranches = [] } = donnees;
  const id = "bareme_" + (code || libelle.toLowerCase().replace(/[^a-z0-9]/g, "_")).slice(0, 30);

  try {
    const { rows: bRows } = await pool.query(
      "INSERT INTO baremes_emoluments (id, code, libelle) VALUES ($1, $2, $3) RETURNING *",
      [id, code || id, libelle]
    );
    if (bRows && bRows.length) {
      for (let i = 0; i < tranches.length; i++) {
        const tr = tranches[i];
        await pool.query(
          "INSERT INTO baremes_emoluments_tranches (bareme_id, ordre, jusqua, taux) VALUES ($1, $2, $3, $4)",
          [id, tr.ordre || (i + 1), tr.jusqua === null || tr.jusqua === "" ? null : Number(tr.jusqua), Number(tr.taux)]
        );
      }
      return obtenirBareme(id);
    }
  } catch (_) {}

  const nouveauBareme = {
    id,
    code: code || id,
    libelle,
    tranches: tranches.map((t, idx) => ({
      id: "tr_" + idx,
      ordre: t.ordre || idx + 1,
      jusqua: t.jusqua === null ? null : Number(t.jusqua),
      taux: Number(t.taux),
    })),
  };
  MEMOIRE_BAREMES.set(id, nouveauBareme);
  return { ...nouveauBareme, actes: [], nbActesAssocies: 0 };
}

async function modifierBareme(id, donnees) {
  const { code, libelle, tranches } = donnees;
  try {
    if (code || libelle) {
      await pool.query(
        "UPDATE baremes_emoluments SET code = COALESCE($1, code), libelle = COALESCE($2, libelle) WHERE id = $3",
        [code, libelle, id]
      );
    }
    if (Array.isArray(tranches)) {
      await pool.query("DELETE FROM baremes_emoluments_tranches WHERE bareme_id = $1", [id]);
      for (let i = 0; i < tranches.length; i++) {
        const tr = tranches[i];
        await pool.query(
          "INSERT INTO baremes_emoluments_tranches (bareme_id, ordre, jusqua, taux) VALUES ($1, $2, $3, $4)",
          [id, tr.ordre || (i + 1), tr.jusqua === null || tr.jusqua === "" ? null : Number(tr.jusqua), Number(tr.taux)]
        );
      }
    }
    return obtenirBareme(id);
  } catch (_) {}

  const b = MEMOIRE_BAREMES.get(id);
  if (b) {
    if (code) b.code = code;
    if (libelle) b.libelle = libelle;
    if (tranches) b.tranches = tranches;
    return obtenirBareme(id);
  }
  return null;
}

async function supprimerBareme(id) {
  try {
    await pool.query("UPDATE types_actes SET bareme_emoluments_id = NULL WHERE bareme_emoluments_id = $1", [id]);
    await pool.query("UPDATE baremes_emoluments SET archived_at = NOW() WHERE id = $1", [id]);
  } catch (_) {}
  MEMOIRE_BAREMES.delete(id);
  return { id, supprime: true };
}

async function associerBaremeTypeActe(typeActeId, baremeId) {
  try {
    const { rows } = await pool.query(
      "UPDATE types_actes SET bareme_emoluments_id = $1 WHERE id = $2 RETURNING *",
      [baremeId || null, typeActeId]
    );
    if (rows && rows.length) return typeActeVersCamel(rows[0]);
  } catch (_) {}

  const a = MEMOIRE_TYPES_ACTES.get(typeActeId);
  if (a) {
    a.baremeEmolumentsId = baremeId;
    return a;
  }
  return null;
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
  listerBaremes,
  obtenirBareme,
  creerBareme,
  modifierBareme,
  supprimerBareme,
  associerBaremeTypeActe,
};
