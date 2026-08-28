/**
 * scripts/importer-referentiel.js — Importe le catalogue réel du cabinet.
 *
 * Source des données : seed/etude1_catalogue.json, extrait de
 * "PLANING DES TACHES DE DEUX ETUDES.xlsx" (feuille "etude 1") fournie par
 * l'utilisatrice — donc la pratique RÉELLE d'un office notarial ivoirien,
 * pas une liste inventée. seed/etude2_catalogue.json (feuille "etude 2")
 * est conservé comme second exemple de référence, importable de la même
 * façon si un autre cabinet préfère partir de ses propres durées ; voir
 * `node scripts/importer-referentiel.js etude2` pour l'utiliser à la place.
 * Dans tous les cas, une fois importées, TOUTES les durées et tâches
 * restent modifiables depuis l'écran Paramètres (API /api/referentiel) —
 * ce script ne s'exécute qu'une fois, à l'installation.
 *
 * Ce script fait deux choses que les données brutes de l'Excel ne
 * fournissaient pas telles quelles, documentées ici pour qu'un futur
 * développeur comprenne le raisonnement :
 *
 * 1. RATTACHEMENT DE CHAQUE TÂCHE À UNE ÉTAPE DU PIPELINE (1 à 6)
 *    L'Excel liste les tâches dans l'ordre d'exécution mais ne les
 *    étiquette pas par étape. `classifierEtape()` ci-dessous fait cette
 *    correspondance à partir du libellé de la tâche (ex. "Collecte" =>
 *    étape 1, "Rédaction" => étape 3, "Délivrance" => étape 6). C'est un
 *    classement raisonnable mais fait main : si le cabinet n'est pas
 *    d'accord sur le classement d'une tâche précise, il se corrige
 *    ensuite librement (PATCH /api/referentiel/taches-standard/:id) sans
 *    reprise de développement.
 *
 * 2. RÈGLES FISCALES PAR TYPE D'ACTE (barème d'émoluments, droit
 *    d'enregistrement, taxe foncière)
 *    Seules les valeurs explicitement confirmées (par le Décret 2013-279
 *    donné dans le cahier des charges, ou par les documents réels du
 *    cabinet — voir NOTES_HYPOTHESES.md) sont appliquées ici. Tout type
 *    d'acte non couvert par une règle confirmée reste au comportement
 *    conservateur par défaut : droit d'enregistrement "a_confirmer" (0
 *    appliqué), pas de barème d'émoluments (minimum légal de minute
 *    seul). La taxe foncière est activée automatiquement pour tout acte
 *    dont au moins une tâche mentionne une inscription/mutation au livre
 *    foncier — c'est une inférence structurelle (pas un taux), documentée
 *    ci-dessous dans `INDICES_TAXE_FONCIERE`.
 *
 * Lancement : `npm run seed` (ou `node scripts/importer-referentiel.js`).
 * Ne réimporte rien si le référentiel contient déjà des types d'actes
 * (idempotent, sûr à relancer par erreur).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool, avecTransaction } = require("../src/db/pool");

function normaliser(texte) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les diacritiques (accents) après décomposition NFD
    .toLowerCase();
}

// Ordre de priorité : la première règle dont le mot-clé apparaît dans le
// libellé normalisé l'emporte. Voir le commentaire d'en-tête, point 1.
const REGLES_ETAPE = [
  [1, ["collecte d'information", "collecte d'informations", "collete d'information"]],
  [4, ["signature", "rdv de signature", "certification de signature"]],
  [3, ["redaction"]],
  [6, [
    "delivrance", "transmission de pieces aux clients",
  ]],
  // Étape 2 — Réquisitions & états préalables : collecte des pièces
  // justificatives et vérifications AVANT rédaction (précède toujours la
  // rédaction dans l'ordre réel des tâches de l'Excel source).
  [2, [
    "requisition", "retrait etat foncier", "retrait d'etat foncier",
    "verification", "verifiaction", "visite du bien", "demande de certificat", "demande d'etat domanial",
    "etablissement du dossier technique", "etablissement de dossier technique", "demande d'acd",
    "depot au guichet unique", "certificat de non faillite", "verification du lot",
  ]],
  // Étape 5 — Formalités DGI & Conservation Foncière : dépôts et
  // démarches d'enregistrement/inscription APRÈS la signature.
  [5, [
    "depot a la conservation", "depots a la conservation", "depot a la concervation",
    "enregistrement et retrait", "retrait de la minute", "retrait de la munite", // "munite" : coquille présente dans la source réelle
    "mutation au livre foncier", "inscription au livre foncier",
    "inscription hypothecaire", "transmission au cadastre", "bornage",
    "creation de titre foncier", "creation du titre foncier", // les deux formulations apparaissent dans la source réelle
    "creaton de dm", "transmission a la conservation", "transmission du tf",
    "publicite a la conservation", "delivrance de l'attestation domaniale", "delivrance du bm",
    "projet d'acd", "retrait de la notification", "retrait de l'acd", "mis en ligne",
    "annonce legale", "legalisation des journaux", "depot au cepici", "preparation du dossier tca",
    "depot et retrait au tca", "depot au greffe", "depots au greffe", "retrait de rccm",
    "demande et retrait etat foncier", "depot a la conservation foncier et demande de radiation",
  ]],
];
// NOTE : "delivrance de l'attestation domaniale" et "delivrance du bm"
// apparaissent dans REGLES_ETAPE[5] (étape 5) alors que le mot "délivrance"
// seul est classé étape 6 — exception volontaire : ce sont des documents
// intermédiaires reçus de l'administration foncière PENDANT la
// régularisation, pas une remise finale au client. La règle étape 5 est
// testée avant la règle étape 6 générique grâce à l'ordre du tableau
// ci-dessus (les règles précédentes dans REGLES_ETAPE sont vérifiées en
// premier — sauf ici où on veut au contraire que ces deux cas précis
// gagnent sur "delivrance" générique : voir classifierEtape().
const EXCEPTIONS_ETAPE_5_AVANT_DELIVRANCE = ["delivrance de l'attestation domaniale", "delivrance du bm"];

function classifierEtape(libelleTache) {
  const n = normaliser(libelleTache);
  for (const motCle of EXCEPTIONS_ETAPE_5_AVANT_DELIVRANCE) {
    if (n.includes(motCle)) return 5;
  }
  for (const [etape, motsCles] of REGLES_ETAPE) {
    if (motsCles.some((m) => n.includes(m))) return etape;
  }
  return 3; // repli conservateur : "rédaction / traitement du dossier" si rien ne correspond
}

// Toute tâche dont le libellé contient un de ces indices déclenche
// l'application automatique de la taxe foncière (1,2 % + 3 000 FCFA,
// confirmée par l'exemple réel de mainlevée d'hypothèque — voir
// fiscal.service.js) sur le type d'acte correspondant.
const INDICES_TAXE_FONCIERE = [
  "mutation au livre foncier", "inscription au livre foncier", "inscription hypothecaire",
  "creation de titre foncier", "demande de radiation",
];

function detecteTaxeFonciere(taches) {
  return taches.some((t) => {
    const n = normaliser(t.libelle);
    return INDICES_TAXE_FONCIERE.some((m) => n.includes(m));
  });
}

// Une tâche est marquée "bloquante" (voir alertes.service.js — un dossier
// dont une tâche bloquante non atteinte n'est pas "effectuée" déclenche
// l'alerte "pièce manquante") si elle est un préalable structurel à tout
// le reste du dossier : sans collecte d'informations, rédaction, ou
// signature, aucune tâche suivante n'a de sens. C'est une inférence
// structurelle sur le déroulement d'un acte notarié, pas une règle
// fiscale ou juridique — le cabinet peut librement marquer d'autres
// tâches comme bloquantes ensuite (le champ reste éditable).
const MOTS_CLES_BLOQUANTE = ["collecte d'information", "collecte d'informations", "collete d'information", "redaction", "signature"];

function estBloquante(libelleTache) {
  const n = normaliser(libelleTache);
  return MOTS_CLES_BLOQUANTE.some((m) => n.includes(m));
}

// Règles fiscales confirmées, par libellé EXACT de type d'acte (tel qu'il
// apparaît dans seed/etude1_catalogue.json). Tout ce qui n'est pas listé
// ici reste au comportement par défaut conservateur (voir en-tête).
//   bareme: null | 'vente' | 'societe' | 'pret'
//   droit: { mode: 'pourcentage'|'fixe'|'a_confirmer', valeur: number }
const REGLES_FISCALES = {
  "Acte de vente SCS": { bareme: "vente", droit: { mode: "pourcentage", valeur: 0.04 } },
  "Acte de vente avec Titre de propriété": { bareme: "vente", droit: { mode: "pourcentage", valeur: 0.04 } },
  "Acte de vente + morcellement": { bareme: "vente", droit: { mode: "pourcentage", valeur: 0.04 } },
  "VENTE D'UNE PARCELLE FONCIER RURALE": { bareme: "vente", droit: { mode: "pourcentage", valeur: 0.04 } },

  "Acte lié à la création d'entreprise": { bareme: "societe", droit: { mode: "a_confirmer", valeur: 0 } },
  "Acte lié à la modification de sociétés": { bareme: "societe", droit: { mode: "a_confirmer", valeur: 0 } },

  "Acte lié au bail à construction": { bareme: null, droit: { mode: "pourcentage", valeur: 0.025 } },
  "Acte lié au bail à usage professionnel": { bareme: null, droit: { mode: "pourcentage", valeur: 0.025 } },
  "Acte lié au bail rural": { bareme: null, droit: { mode: "pourcentage", valeur: 0.025 } },

  "Déclaration de succession": { bareme: null, droit: { mode: "pourcentage", valeur: 0.03 } },

  "Si bien immobilier": { bareme: "pret", droit: { mode: "pourcentage", valeur: 0.015 }, taxeFonciereForce: true },
  "Reconnaissance de dette": { bareme: "pret", droit: { mode: "pourcentage", valeur: 0.015 } },

  "MAINLEVEE D'HYPOTHEQUE": { bareme: null, droit: { mode: "fixe", valeur: 18000 }, taxeFonciereForce: true },
};

const BAREMES_DECRET = {
  vente: [
    { jusqua: 10000000, taux: 0.04 },
    { jusqua: 30000000, taux: 0.025 },
    { jusqua: 90000000, taux: 0.015 },
    { jusqua: null, taux: 0.0075 },
  ],
  societe: [
    { jusqua: 10000000, taux: 0.03 },
    { jusqua: 30000000, taux: 0.015 },
    { jusqua: 90000000, taux: 0.0075 },
    { jusqua: null, taux: 0.0035 },
  ],
  pret: [
    { jusqua: 10000000, taux: 0.02 },
    { jusqua: 30000000, taux: 0.01 },
    { jusqua: 90000000, taux: 0.005 },
    { jusqua: null, taux: 0.0025 },
  ],
};

async function creerBaremes(client) {
  const ids = {};
  for (const [code, tranches] of Object.entries(BAREMES_DECRET)) {
    const { rows } = await client.query(
      "INSERT INTO baremes_emoluments (code, libelle) VALUES ($1, $2) RETURNING id",
      [code, `Barème ${code} (Décret 2013-279)`]
    );
    ids[code] = rows[0].id;
    let ordre = 1;
    for (const t of tranches) {
      await client.query(
        "INSERT INTO baremes_emoluments_tranches (bareme_id, ordre, jusqua, taux) VALUES ($1, $2, $3, $4)",
        [ids[code], ordre++, t.jusqua, t.taux]
      );
    }
  }
  return ids;
}

async function importer(nomProfil) {
  const cheminFichier = path.join(__dirname, "..", "seed", `${nomProfil}_catalogue.json`);
  const actes = JSON.parse(fs.readFileSync(cheminFichier, "utf-8"));

  await avecTransaction(async (client) => {
    const { rows: existants } = await client.query("SELECT COUNT(*)::int AS n FROM types_actes");
    if (existants[0].n > 0) {
      console.log("[seed] le référentiel contient déjà des types d'actes — import ignoré (idempotent).");
      return;
    }

    const baremeIds = await creerBaremes(client);

    const classificationIds = {};
    let ordreClassification = 0;
    for (const acte of actes) {
      const nom = acte.classification || "Autres actes";
      if (!classificationIds[nom]) {
        const { rows } = await client.query(
          "INSERT INTO classifications_actes (libelle, ordre) VALUES ($1, $2) RETURNING id",
          [nom, ordreClassification++]
        );
        classificationIds[nom] = rows[0].id;
      }
    }

    let nombreActes = 0;
    let nombreTaches = 0;
    for (const acte of actes) {
      const regle = REGLES_FISCALES[acte.libelle] || { bareme: null, droit: { mode: "a_confirmer", valeur: 0 } };
      const taxeFonciereApplicable = regle.taxeFonciereForce || detecteTaxeFonciere(acte.taches);
      const delaiTotal = acte.taches.reduce((s, t) => s + (typeof t.jours === "number" ? t.jours : 0), 0);

      const { rows } = await client.query(
        `INSERT INTO types_actes
           (classification_id, libelle, delai_standard_jours, bareme_emoluments_id,
            droit_enregistrement_mode, droit_enregistrement_valeur, taxe_fonciere_applicable)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          classificationIds[acte.classification || "Autres actes"],
          acte.libelle,
          delaiTotal,
          regle.bareme ? baremeIds[regle.bareme] : null,
          regle.droit.mode,
          regle.droit.valeur,
          taxeFonciereApplicable,
        ]
      );
      const typeActeId = rows[0].id;
      nombreActes++;

      let ordre = 1;
      for (const tache of acte.taches) {
        const jours = typeof tache.jours === "number" ? tache.jours : 1;
        await client.query(
          `INSERT INTO taches_standard (type_acte_id, etape, ordre, libelle, duree_jours, bloquante)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [typeActeId, classifierEtape(tache.libelle), ordre++, tache.libelle.trim(), jours, estBloquante(tache.libelle)]
        );
        nombreTaches++;
      }
    }

    console.log(`[seed] importé depuis ${nomProfil} : ${nombreActes} types d'actes, ${nombreTaches} tâches standard.`);
  });
}

if (require.main === module) {
  const profil = process.argv[2] || "etude1";
  importer(profil)
    .then(() => pool.end())
    .catch((erreur) => {
      console.error(erreur);
      pool.end();
      process.exit(1);
    });
}

module.exports = { importer, classifierEtape, detecteTaxeFonciere, estBloquante, normaliser };
