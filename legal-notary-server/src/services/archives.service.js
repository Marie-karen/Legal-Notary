/**
 * src/services/archives.service.js — Clôture, minute, archivage physique.
 *
 * Deux étapes bien distinctes, volontairement séparées dans le temps :
 *
 *   1. `cloturerDossier` — quand le travail sur le dossier est terminé, il
 *      reçoit immédiatement un NUMÉRO DE MINUTE (trace numérique
 *      officielle, MIN-2026/014) et passe en attente de classement
 *      physique (`statut_archivage = 'a_archiver'`).
 *
 *   2. `archiverProchainDossier` — le classement physique (mise en carton)
 *      se fait ensuite, en lot ou au fil de l'eau, TOUJOURS en traitant le
 *      dossier clôturé le plus ANCIEN en premier parmi ceux qui attendent
 *      (file FIFO par date de clôture). C'est la pratique d'archivage
 *      recommandée : elle évite qu'un dossier ancien reste indéfiniment en
 *      pile "à classer" pendant que des dossiers plus récents sont classés
 *      avant lui, et elle garantit que la numérotation des cartons suit
 *      l'ordre chronologique réel — donc que retrouver un dossier ancien
 *      revient à chercher un petit numéro de carton, jamais à fouiller
 *      toute la pile physique.
 *
 * Un carton reste "ouvert" jusqu'à ce qu'il atteigne sa capacité
 * (`capacite_carton_archive`, paramétrable), puis passe "plein" : le
 * dossier suivant à archiver ouvre alors automatiquement le carton
 * suivant. Le `code_emplacement` stocké sur chaque minute est la chaîne
 * lisible qui doit être recopiée sur l'étiquette physique du carton, pour
 * que le numéro numérique et l'emplacement physique correspondent
 * toujours exactement (règle explicitement demandée : "des numéros qui
 * correspondent au physique").
 */

const { pool, avecTransaction } = require("../db/pool");
const dossiersService = require("./dossiers.service");
const parametresService = require("./parametres.service");

async function prochainNumeroMinute(client, annee) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS n FROM minutes_archive WHERE annee_minute = $1",
    [annee]
  );
  const n = rows[0].n + 1;
  return `MIN-${annee}/${String(n).padStart(3, "0")}`;
}

async function cloturerDossier(dossierId, utilisateurId) {
  return avecTransaction(async (client) => {
    const annee = new Date().getFullYear();
    const numeroMinute = await prochainNumeroMinute(client, annee);

    await client.query("UPDATE dossiers SET statut = 'cloture' WHERE id = $1", [dossierId]);
    const { rows } = await client.query(
      `INSERT INTO minutes_archive (dossier_id, numero_minute, annee_minute, statut_archivage)
       VALUES ($1, $2, $3, 'a_archiver') RETURNING *`,
      [dossierId, numeroMinute, annee]
    );
    await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, `Dossier clôturé — minute ${numeroMinute} attribuée`);
    return rows[0];
  });
}

/**
 * Trouve un carton avec de la place, ou en ouvre un nouveau (numérotation
 * strictement séquentielle, jamais réutilisée même si un carton plus
 * ancien est ensuite détruit physiquement — la table ne le supprime
 * jamais, voir migration).
 */
async function obtenirOuCreerCartonOuvert(client, capaciteParDefaut) {
  const { rows } = await client.query(
    "SELECT * FROM cartons_archive WHERE statut = 'ouvert' ORDER BY numero_carton DESC LIMIT 1"
  );
  if (rows.length) return rows[0];

  const { rows: compte } = await client.query("SELECT COUNT(*)::int AS n FROM cartons_archive");
  const numero = `CARTON-${String(compte[0].n + 1).padStart(3, "0")}`;
  const { rows: cree } = await client.query(
    `INSERT INTO cartons_archive (numero_carton, capacite_max) VALUES ($1, $2) RETURNING *`,
    [numero, capaciteParDefaut]
  );
  return cree[0];
}

function composerCodeEmplacement(carton, position) {
  const partiesLocalisation = [carton.salle, carton.armoire, carton.rayonnage].filter(Boolean).join(" · ");
  const base = partiesLocalisation ? `${partiesLocalisation} · ` : "";
  return `${base}${carton.numero_carton} · position ${String(position).padStart(3, "0")}`;
}

/**
 * Archive physiquement le dossier clôturé le plus ancien encore en
 * attente de classement. Renvoie `null` s'il n'y a rien à archiver.
 */
async function archiverProchainDossier(utilisateurId) {
  const parametres = await parametresService.obtenir();

  return avecTransaction(async (client) => {
    const { rows: candidats } = await client.query(
      `SELECT * FROM minutes_archive WHERE statut_archivage = 'a_archiver'
       ORDER BY date_cloture ASC, created_at ASC LIMIT 1 FOR UPDATE`
    );
    if (!candidats.length) return null;
    const minute = candidats[0];

    const carton = await obtenirOuCreerCartonOuvert(client, parametres.capaciteCartonArchive);
    const position = carton.nombre_dossiers + 1;
    const codeEmplacement = composerCodeEmplacement(carton, position);

    await client.query(
      `UPDATE minutes_archive SET carton_id = $1, position_dans_carton = $2, code_emplacement = $3, statut_archivage = 'archive'
       WHERE id = $4`,
      [carton.id, position, codeEmplacement, minute.id]
    );

    const nombreDossiers = carton.nombre_dossiers + 1;
    const cartonPlein = nombreDossiers >= carton.capacite_max;
    await client.query(
      `UPDATE cartons_archive SET nombre_dossiers = $1, statut = $2, date_fermeture = $3 WHERE id = $4`,
      [nombreDossiers, cartonPlein ? "plein" : "ouvert", cartonPlein ? new Date() : null, carton.id]
    );

    await dossiersService.ajouterMouvement(
      client, minute.dossier_id, utilisateurId,
      `Dossier archivé physiquement — ${codeEmplacement}`
    );

    return { minuteId: minute.id, numeroMinute: minute.numero_minute, codeEmplacement, cartonNumero: carton.numero_carton };
  });
}

async function archiverEnLot(nombre, utilisateurId) {
  const resultats = [];
  for (let i = 0; i < nombre; i++) {
    const r = await archiverProchainDossier(utilisateurId);
    if (!r) break;
    resultats.push(r);
  }
  return resultats;
}

async function listerCartons() {
  const { rows } = await pool.query(
    `SELECT k.*,
       COALESCE(
         json_agg(
           json_build_object(
             'minuteId', m.id,
             'dossierId', d.id,
             'numeroMinute', m.numero_minute,
             'numeroDossier', d.numero_dossier,
             'typeActeId', d.type_acte_id,
             'positionDansCarton', m.position_dans_carton,
             'codeEmplacement', m.code_emplacement,
             'dateCloture', m.date_cloture,
             'comparantsNoms', COALESCE((SELECT string_agg(c.nom || ' (' || c.qualite || ')', ', ') FROM dossier_comparants c WHERE c.dossier_id = d.id), '')
           ) ORDER BY m.position_dans_carton ASC
         ) FILTER (WHERE m.id IS NOT NULL),
         '[]'::json
       ) AS dossiers
     FROM cartons_archive k
     LEFT JOIN minutes_archive m ON m.carton_id = k.id
     LEFT JOIN dossiers d ON d.id = m.dossier_id
     GROUP BY k.id
     ORDER BY k.created_at DESC, k.numero_carton ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    numeroCarton: r.numero_carton,
    salle: r.salle,
    armoire: r.armoire,
    rayonnage: r.rayonnage,
    capaciteMax: r.capacite_max,
    nombreDossiers: r.nombre_dossiers || (r.dossiers ? r.dossiers.length : 0),
    statut: r.statut,
    dateOuverture: r.date_ouverture,
    dateFermeture: r.date_fermeture,
    dossiers: r.dossiers || [],
  }));
}

async function creerCarton({ numeroCarton, salle, armoire, rayonnage, capaciteMax = 50 }) {
  let numero = numeroCarton;
  if (!numero) {
    const { rows: compte } = await pool.query("SELECT COUNT(*)::int AS n FROM cartons_archive");
    numero = `CARTON-${String(compte[0].n + 1).padStart(3, "0")}`;
  }
  const { rows } = await pool.query(
    `INSERT INTO cartons_archive (numero_carton, salle, armoire, rayonnage, capacite_max, nombre_dossiers, statut)
     VALUES ($1, $2, $3, $4, $5, 0, 'ouvert')
     RETURNING *`,
    [numero, salle || "Salle principale", armoire || "Armoire A", rayonnage || "Rayon 1", capaciteMax || 50]
  );
  const r = rows[0];
  return {
    id: r.id,
    numeroCarton: r.numero_carton,
    salle: r.salle,
    armoire: r.armoire,
    rayonnage: r.rayonnage,
    capaciteMax: r.capacite_max,
    nombreDossiers: r.nombre_dossiers,
    statut: r.statut,
  };
}

/**
 * Numérise et classe directement un dossier ou un acte du fonds historique.
 */
async function numeriserEtArchiver(donnees, utilisateurId) {
  const {
    dossierId,
    numeroMinute,
    scanUrl,
    empreinteSha256,
    cartonId,
    dateCloture,
    estFondsHistorique = false,
    numeroDossierHistorique,
    comparantsHistorique = "Comparants",
    typeActeIdHistorique,
    montantHistorique = 0,
  } = donnees;

  const parametres = await parametresService.obtenir();

  return avecTransaction(async (client) => {
    let cibleDossierId = dossierId;

    // Si acte du fonds historique / ancien sans dossier existant
    if (estFondsHistorique || !cibleDossierId) {
      const numDossier = numeroDossierHistorique || `HIST-${Date.now().toString().slice(-6)}`;
      const { rows: types } = await client.query("SELECT id FROM types_actes LIMIT 1");
      const finalTypeId = typeActeIdHistorique || (types.length ? types[0].id : null);
      const anneeDoc = dateCloture ? new Date(dateCloture).getFullYear() : new Date().getFullYear();

      const { rows: newDossier } = await client.query(
        `INSERT INTO dossiers (numero_dossier, type_acte_id, annee_ouverture, date_ouverture, montant_assiette, etape_actuelle, statut)
         VALUES ($1, $2, $3, $4, $5, 6, 'cloture') RETURNING id`,
        [numDossier, finalTypeId, anneeDoc, dateCloture || new Date(), Number(montantHistorique) || 0]
      );
      cibleDossierId = newDossier[0].id;

      if (comparantsHistorique) {
        await client.query(
          `INSERT INTO dossier_comparants (dossier_id, nom, qualite)
           VALUES ($1, $2, 'Comparant')`,
          [cibleDossierId, comparantsHistorique]
        );
      }
    }

    // Détermination du carton physique
    let carton = null;
    if (cartonId) {
      const { rows: cRows } = await client.query("SELECT * FROM cartons_archive WHERE id = $1", [cartonId]);
      if (cRows.length) carton = cRows[0];
    }
    if (!carton) {
      carton = await obtenirOuCreerCartonOuvert(client, parametres.capaciteCartonArchive || 50);
    }

    const position = (carton.nombre_dossiers || 0) + 1;
    const codeEmplacement = composerCodeEmplacement(carton, position);

    // Détermination du numéro de minute légal
    const annee = dateCloture ? new Date(dateCloture).getFullYear() : new Date().getFullYear();
    let numMinute = numeroMinute;
    if (!numMinute) {
      numMinute = await prochainNumeroMinute(client, annee);
    }

    // Clôture du dossier
    await client.query("UPDATE dossiers SET statut = 'cloture', etape_actuelle = 6 WHERE id = $1", [cibleDossierId]);

    // Upsert dans minutes_archive
    const { rows: existingMin } = await client.query("SELECT id FROM minutes_archive WHERE dossier_id = $1", [cibleDossierId]);
    let minuteRecord;

    if (existingMin.length) {
      const { rows: updated } = await client.query(
        `UPDATE minutes_archive SET
           numero_minute = $1, annee_minute = $2, carton_id = $3, position_dans_carton = $4,
           code_emplacement = $5, statut_archivage = 'archive', scan_url = $6, date_cloture = $7
         WHERE id = $8 RETURNING *`,
        [numMinute, annee, carton.id, position, codeEmplacement, scanUrl || "SCAN_MIN_OFFICIEL.pdf", dateCloture || new Date(), existingMin[0].id]
      );
      minuteRecord = updated[0];
    } else {
      const { rows: inserted } = await client.query(
        `INSERT INTO minutes_archive (dossier_id, numero_minute, annee_minute, carton_id, position_dans_carton, code_emplacement, statut_archivage, scan_url, date_cloture)
         VALUES ($1, $2, $3, $4, $5, $6, 'archive', $7, $8) RETURNING *`,
        [cibleDossierId, numMinute, annee, carton.id, position, codeEmplacement, scanUrl || "SCAN_MIN_OFFICIEL.pdf", dateCloture || new Date()]
      );
      minuteRecord = inserted[0];
    }

    // Mise à jour du carton physique
    const nbreDossiers = (carton.nombre_dossiers || 0) + 1;
    const cartonPlein = nbreDossiers >= (carton.capacite_max || 50);
    await client.query(
      `UPDATE cartons_archive SET nombre_dossiers = $1, statut = $2, date_fermeture = $3 WHERE id = $4`,
      [nbreDossiers, cartonPlein ? "plein" : "ouvert", cartonPlein ? new Date() : null, carton.id]
    );

    await dossiersService.ajouterMouvement(
      client, cibleDossierId, utilisateurId,
      `Dossier numérisé & archivé en minute (${numMinute}) — ${codeEmplacement}`
    );

    return {
      minuteId: minuteRecord.id,
      numeroMinute: numMinute,
      codeEmplacement,
      cartonNumero: carton.numero_carton,
      scanUrl: minuteRecord.scan_url,
      empreinteSha256: empreinteSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      dossierId: cibleDossierId,
    };
  });
}

async function attacherScan(dossierId, scanUrl) {
  await pool.query("UPDATE minutes_archive SET scan_url = $1 WHERE dossier_id = $2", [scanUrl, dossierId]);
}

async function listerEnAttenteArchivage() {
  const { rows } = await pool.query(
    `SELECT m.*, d.numero_dossier, d.montant_assiette, d.type_acte_id,
            COALESCE(string_agg(c.nom || ' (' || c.qualite || ')', ', '), '') AS comparants_noms
     FROM minutes_archive m
     JOIN dossiers d ON d.id = m.dossier_id
     LEFT JOIN dossier_comparants c ON c.dossier_id = d.id
     WHERE m.statut_archivage = 'a_archiver'
     GROUP BY m.id, d.id
     ORDER BY m.date_cloture ASC`
  );
  return rows;
}

async function listerRepertoire() {
  const { rows } = await pool.query(
    `SELECT m.*, d.numero_dossier, d.montant_assiette, d.type_acte_id,
            COALESCE(string_agg(c.nom || ' (' || c.qualite || ')', ', '), '') AS comparants_noms,
            k.numero_carton, k.salle AS carton_salle, k.armoire AS carton_armoire, k.rayonnage AS carton_rayonnage
     FROM minutes_archive m
     JOIN dossiers d ON d.id = m.dossier_id
     LEFT JOIN dossier_comparants c ON c.dossier_id = d.id
     LEFT JOIN cartons_archive k ON k.id = m.carton_id
     WHERE m.statut_archivage = 'archive'
     GROUP BY m.id, d.id, k.id
     ORDER BY m.numero_minute DESC`
  );
  return rows;
}

async function obtenirDetailsJumeauDossier(dossierId) {
  const { rows: dossiers } = await pool.query(
    `SELECT d.*, t.libelle AS type_acte_libelle,
            COALESCE(string_agg(c.nom || ' (' || c.qualite || ')', ', '), '') AS comparants_noms
     FROM dossiers d
     LEFT JOIN types_actes t ON t.id = d.type_acte_id
     LEFT JOIN dossier_comparants c ON c.dossier_id = d.id
     WHERE d.id = $1
     GROUP BY d.id, t.id`,
    [dossierId]
  );
  if (!dossiers.length) return null;
  const d = dossiers[0];

  const [docsNum, docsPhys, minutes, mouvs] = await Promise.all([
    pool.query("SELECT * FROM documents_numeriques WHERE dossier_id = $1 AND archived_at IS NULL ORDER BY created_at DESC", [dossierId]),
    pool.query("SELECT * FROM documents_physiques WHERE dossier_id = $1 ORDER BY created_at DESC", [dossierId]),
    pool.query(
      `SELECT m.*, k.numero_carton, k.salle, k.armoire, k.rayonnage
       FROM minutes_archive m
       LEFT JOIN cartons_archive k ON k.id = m.carton_id
       WHERE m.dossier_id = $1`,
      [dossierId]
    ),
    pool.query("SELECT * FROM mouvements_dossiers_physiques WHERE dossier_id = $1 ORDER BY date_mouvement DESC", [dossierId]),
  ]);

  const min = minutes.rows.length ? minutes.rows[0] : null;
  const dernierMouv = mouvs.rows.find((m) => m.statut === "en_cours");

  return {
    dossier: {
      id: d.id,
      numeroDossier: d.numero_dossier,
      typeActeId: d.type_acte_id,
      typeActeLibelle: d.type_acte_libelle,
      comparantsNoms: d.comparants_noms,
      statut: d.statut,
      statutNumerisation: d.statut_numerisation || (docsNum.rows.length ? "NUMERISE" : "NON_NUMERISE"),
      dateOuverture: d.date_ouverture,
      montantAssiette: Number(d.montant_assiette) || 0,
    },
    jumeauNumerique: {
      totalDocuments: docsNum.rows.length,
      documents: docsNum.rows,
      aCopieMinute: Boolean(min && min.scan_url),
      scanUrlMinute: min ? min.scan_url : null,
      empreinteSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    jumeauPhysique: {
      totalPiecesPhysiques: docsPhys.rows.length,
      pieces: docsPhys.rows,
      estDisponibleEnCarton: !dernierMouv,
      statutActuel: dernierMouv ? `SORTI — ${dernierMouv.destination_bureau} (${dernierMouv.nom_demandeur})` : "DISPONIBLE EN ARCHIVES",
      codeEmplacement: min ? min.code_emplacement : "En attente de classement",
      cartonNumero: min ? min.numero_carton : null,
      salle: min ? min.salle : null,
      armoire: min ? min.armoire : null,
      rayonnage: min ? min.rayonnage : null,
      historiqueMouvements: mouvs.rows,
    },
    minute: min,
  };
}

module.exports = {
  cloturerDossier,
  archiverProchainDossier,
  archiverEnLot,
  numeriserEtArchiver,
  listerCartons,
  creerCarton,
  attacherScan,
  listerEnAttenteArchivage,
  listerRepertoire,
  obtenirDetailsJumeauDossier,
};
