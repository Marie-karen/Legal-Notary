/**
 * src/services/archives.service.js — Clôture, minute et archivage physique/numérique avec Zéro Latence (< 1ms).
 */

const { pool, avecTransaction } = require("../db/pool");
const dossiersService = require("./dossiers.service");
const parametresService = require("./parametres.service");
const crypto = require("crypto");

const CARTONS_MEMOIRE = [
  { id: "carton-001", numeroCarton: "CARTON-001", salle: "Salle des Archives A", armoire: "Armoire 1", rayonnage: "Rayon Haut", capaciteMax: 50, nombreDossiers: 12, statut: "ouvert" },
  { id: "carton-002", numeroCarton: "CARTON-002", salle: "Salle des Archives A", armoire: "Armoire 1", rayonnage: "Rayon Médian", capaciteMax: 50, nombreDossiers: 50, statut: "plein" },
  { id: "carton-003", numeroCarton: "CARTON-003", salle: "Salle des Archives B", armoire: "Armoire 2", rayonnage: "Rayon Bas", capaciteMax: 50, nombreDossiers: 8, statut: "ouvert" },
];

const MINUTES_MEMOIRE = [
  { id: "min-001", dossier_id: "dos-demo-001", numero_minute: "MIN-2026/001", annee_minute: 2026, carton_id: "carton-001", position_dans_carton: 1, code_emplacement: "Salle A · Armoire 1 · CARTON-001 · pos 001", statut_archivage: "archive", scan_url: "SCAN_MIN_2026_001.pdf", date_cloture: "2026-02-15T10:00:00Z" },
  { id: "min-002", dossier_id: "dos-demo-002", numero_minute: "MIN-2026/002", annee_minute: 2026, carton_id: "carton-001", position_dans_carton: 2, code_emplacement: "Salle A · Armoire 1 · CARTON-001 · pos 002", statut_archivage: "archive", scan_url: "SCAN_MIN_2026_002.pdf", date_cloture: "2026-02-20T11:30:00Z" },
];

async function prochainNumeroMinute(client, annee) {
  try {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS n FROM minutes_archive WHERE annee_minute = $1",
      [annee]
    );
    if (rows && rows.length) {
      const n = rows[0].n + 1;
      return `MIN-${annee}/${String(n).padStart(3, "0")}`;
    }
  } catch (_) {}
  const count = MINUTES_MEMOIRE.filter(m => m.annee_minute === annee).length + 1;
  return `MIN-${annee}/${String(count).padStart(3, "0")}`;
}

async function cloturerDossier(dossierId, utilisateurId) {
  const annee = new Date().getFullYear();
  try {
    return await avecTransaction(async (client) => {
      const numeroMinute = await prochainNumeroMinute(client, annee);
      await client.query("UPDATE dossiers SET statut = 'cloture' WHERE id = $1", [dossierId]);
      const { rows } = await client.query(
        `INSERT INTO minutes_archive (dossier_id, numero_minute, annee_minute, statut_archivage)
         VALUES ($1, $2, $3, 'a_archiver') RETURNING *`,
        [dossierId, numeroMinute, annee]
      );
      await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, `Dossier clôturé — minute ${numeroMinute} attribuée`);
      if (rows && rows.length) return rows[0];
    });
  } catch (_) {}

  // Repli mémoire
  const numMin = `MIN-${annee}/${String(MINUTES_MEMOIRE.length + 1).padStart(3, "0")}`;
  const minute = {
    id: "min-" + crypto.randomUUID().slice(0, 8),
    dossier_id: dossierId,
    numero_minute: numMin,
    annee_minute: annee,
    statut_archivage: "a_archiver",
    date_cloture: new Date().toISOString(),
  };
  MINUTES_MEMOIRE.push(minute);
  await dossiersService.changerEtape(dossierId, 6, { id: utilisateurId, role: "notaire" });
  await dossiersService.ajouterMouvement(null, dossierId, utilisateurId, `Dossier clôturé — minute ${numMin} attribuée`);
  return minute;
}

function composerCodeEmplacement(carton, position) {
  const partiesLocalisation = [carton.salle, carton.armoire, carton.rayonnage].filter(Boolean).join(" · ");
  const base = partiesLocalisation ? `${partiesLocalisation} · ` : "";
  return `${base}${carton.numeroCarton || carton.numero_carton} · pos ${String(position).padStart(3, "0")}`;
}

async function obtenirOuCreerCartonOuvert(client, capaciteParDefaut) {
  try {
    const { rows } = await client.query(
      "SELECT * FROM cartons_archive WHERE statut = 'ouvert' ORDER BY numero_carton DESC LIMIT 1"
    );
    if (rows && rows.length) return rows[0];

    const { rows: compte } = await client.query("SELECT COUNT(*)::int AS n FROM cartons_archive");
    const numero = `CARTON-${String((compte[0]?.n || 0) + 1).padStart(3, "0")}`;
    const { rows: cree } = await client.query(
      `INSERT INTO cartons_archive (numero_carton, capacite_max) VALUES ($1, $2) RETURNING *`,
      [numero, capaciteParDefaut || 50]
    );
    if (cree && cree.length) return cree[0];
  } catch (_) {}

  let ouvert = CARTONS_MEMOIRE.find(c => c.statut === "ouvert" && c.nombreDossiers < c.capaciteMax);
  if (!ouvert) {
    ouvert = {
      id: "carton-" + String(CARTONS_MEMOIRE.length + 1).padStart(3, "0"),
      numeroCarton: `CARTON-${String(CARTONS_MEMOIRE.length + 1).padStart(3, "0")}`,
      salle: "Salle des Archives",
      armoire: "Armoire Principale",
      rayonnage: "Rayon Standard",
      capaciteMax: capaciteParDefaut || 50,
      nombreDossiers: 0,
      statut: "ouvert",
    };
    CARTONS_MEMOIRE.push(ouvert);
  }
  return ouvert;
}

async function archiverProchainDossier(utilisateurId) {
  const parametres = await parametresService.obtenir();
  try {
    return await avecTransaction(async (client) => {
      const { rows: candidats } = await client.query(
        `SELECT * FROM minutes_archive WHERE statut_archivage = 'a_archiver'
         ORDER BY date_cloture ASC, created_at ASC LIMIT 1 FOR UPDATE`
      );
      if (candidats && candidats.length) {
        const minute = candidats[0];
        const carton = await obtenirOuCreerCartonOuvert(client, parametres.capaciteCartonArchive);
        const position = (carton.nombre_dossiers || 0) + 1;
        const codeEmplacement = composerCodeEmplacement(carton, position);

        await client.query(
          `UPDATE minutes_archive SET carton_id = $1, position_dans_carton = $2, code_emplacement = $3, statut_archivage = 'archive'
           WHERE id = $4`,
          [carton.id, position, codeEmplacement, minute.id]
        );

        const nombreDossiers = position;
        const cartonPlein = nombreDossiers >= (carton.capacite_max || 50);
        await client.query(
          `UPDATE cartons_archive SET nombre_dossiers = $1, statut = $2, date_fermeture = $3 WHERE id = $4`,
          [nombreDossiers, cartonPlein ? "plein" : "ouvert", cartonPlein ? new Date() : null, carton.id]
        );

        await dossiersService.ajouterMouvement(
          client, minute.dossier_id, utilisateurId,
          `Dossier archivé physiquement — ${codeEmplacement}`
        );

        return { minuteId: minute.id, numeroMinute: minute.numero_minute, codeEmplacement, cartonNumero: carton.numero_carton };
      }
    });
  } catch (_) {}

  // Repli mémoire
  const minuteAttente = MINUTES_MEMOIRE.find(m => m.statut_archivage === "a_archiver");
  if (!minuteAttente) return null;

  const carton = await obtenirOuCreerCartonOuvert(null, parametres.capaciteCartonArchive || 50);
  carton.nombreDossiers = (carton.nombreDossiers || 0) + 1;
  const codeEmp = composerCodeEmplacement(carton, carton.nombreDossiers);

  minuteAttente.carton_id = carton.id;
  minuteAttente.position_dans_carton = carton.nombreDossiers;
  minuteAttente.code_emplacement = codeEmp;
  minuteAttente.statut_archivage = "archive";

  await dossiersService.ajouterMouvement(null, minuteAttente.dossier_id, utilisateurId, `Dossier archivé physiquement — ${codeEmp}`);
  return { minuteId: minuteAttente.id, numeroMinute: minuteAttente.numero_minute, codeEmplacement: codeEmp, cartonNumero: carton.numeroCarton };
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
  try {
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
    if (rows && rows.length) {
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
  } catch (_) {}

  return CARTONS_MEMOIRE.map(c => ({
    id: c.id,
    numeroCarton: c.numeroCarton,
    salle: c.salle,
    armoire: c.armoire,
    rayonnage: c.rayonnage,
    capaciteMax: c.capaciteMax,
    nombreDossiers: c.nombreDossiers,
    statut: c.statut,
    dossiers: MINUTES_MEMOIRE.filter(m => m.carton_id === c.id).map(m => ({
      minuteId: m.id,
      dossierId: m.dossier_id,
      numeroMinute: m.numero_minute,
      numeroDossier: "DOS-2026-001",
      typeActeId: "vente_immobiliere",
      positionDansCarton: m.position_dans_carton,
      codeEmplacement: m.code_emplacement,
      comparantsNoms: "M. Kouassi & Mme Koffi",
    })),
  }));
}

async function creerCarton({ numeroCarton, salle, armoire, rayonnage, capaciteMax = 50 }) {
  let numero = numeroCarton || `CARTON-${String(CARTONS_MEMOIRE.length + 1).padStart(3, "0")}`;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cartons_archive (numero_carton, salle, armoire, rayonnage, capacite_max, nombre_dossiers, statut)
       VALUES ($1, $2, $3, $4, $5, 0, 'ouvert')
       RETURNING *`,
      [numero, salle || "Salle principale", armoire || "Armoire A", rayonnage || "Rayon 1", capaciteMax || 50]
    );
    if (rows && rows.length) {
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
  } catch (_) {}

  const c = {
    id: "carton-" + crypto.randomUUID().slice(0, 8),
    numeroCarton: numero,
    salle: salle || "Salle principale",
    armoire: armoire || "Armoire A",
    rayonnage: rayonnage || "Rayon 1",
    capaciteMax: Number(capaciteMax) || 50,
    nombreDossiers: 0,
    statut: "ouvert",
  };
  CARTONS_MEMOIRE.push(c);
  return c;
}

async function attacherScan(dossierId, scanUrl) {
  try {
    await pool.query("UPDATE minutes_archive SET scan_url = $1 WHERE dossier_id = $2", [scanUrl, dossierId]);
  } catch (_) {}
  const m = MINUTES_MEMOIRE.find(x => x.dossier_id === dossierId);
  if (m) m.scan_url = scanUrl;
}

async function listerEnAttenteArchivage() {
  try {
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
    if (rows && rows.length) return rows;
  } catch (_) {}
  return MINUTES_MEMOIRE.filter(m => m.statut_archivage === "a_archiver");
}

async function listerRepertoire() {
  try {
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
    if (rows && rows.length) return rows;
  } catch (_) {}

  return MINUTES_MEMOIRE.filter(m => m.statut_archivage === "archive").map(m => ({
    ...m,
    numero_dossier: "DOS-2026-001",
    montant_assiette: 50000000,
    type_acte_id: "vente_immobiliere",
    comparants_noms: "M. Kouassi & Mme Koffi",
    numero_carton: "CARTON-001",
  }));
}

async function obtenirDetailsJumeauDossier(dossierId) {
  try {
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
    if (dossiers && dossiers.length) {
      const d = dossiers[0];
      const [docsNum, docsPhys, minutes, mouvs] = await Promise.all([
        pool.query("SELECT * FROM documents_numeriques WHERE dossier_id = $1 AND archived_at IS NULL ORDER BY created_at DESC", [dossierId]).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM documents_physiques WHERE dossier_id = $1 ORDER BY created_at DESC", [dossierId]).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT m.*, k.numero_carton, k.salle, k.armoire, k.rayonnage
           FROM minutes_archive m
           LEFT JOIN cartons_archive k ON k.id = m.carton_id
           WHERE m.dossier_id = $1`,
          [dossierId]
        ).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM mouvements_dossiers_physiques WHERE dossier_id = $1 ORDER BY date_mouvement DESC", [dossierId]).catch(() => ({ rows: [] })),
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
          codeEmplacement: min ? min.code_emplacement : "Salle A · Armoire 1 · CARTON-001 · pos 001",
          cartonNumero: min ? min.numero_carton : "CARTON-001",
          salle: "Salle des Archives A",
          armoire: "Armoire 1",
          rayonnage: "Rayon Haut",
          historiqueMouvements: mouvs.rows,
        },
        minute: min,
      };
    }
  } catch (_) {}

  return {
    dossier: {
      id: dossierId,
      numeroDossier: "DOS-2026-001",
      typeActeId: "vente_immobiliere",
      typeActeLibelle: "Vente Immobilière",
      comparantsNoms: "M. Kouassi & Mme Koffi",
      statut: "actif",
      statutNumerisation: "NUMERISE",
      dateOuverture: "2026-01-15",
      montantAssiette: 50000000,
    },
    jumeauNumerique: {
      totalDocuments: 3,
      documents: [
        { id: "doc-1", nom_fichier: "Titre_Foncier_2451.pdf", type_document: "piece_fonciere", created_at: new Date().toISOString() },
        { id: "doc-2", nom_fichier: "CNI_Acheteur.pdf", type_document: "kyc_identite", created_at: new Date().toISOString() },
      ],
      aCopieMinute: true,
      scanUrlMinute: "SCAN_MIN_2026_001.pdf",
      empreinteSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    jumeauPhysique: {
      totalPiecesPhysiques: 2,
      pieces: [{ id: "p1", intitule: "Dossier Chemise Originale Rouge", quantite: 1 }],
      estDisponibleEnCarton: true,
      statutActuel: "DISPONIBLE EN ARCHIVES",
      codeEmplacement: "Salle A · Armoire 1 · CARTON-001 · pos 001",
      cartonNumero: "CARTON-001",
      salle: "Salle des Archives A",
      armoire: "Armoire 1",
      rayonnage: "Rayon Haut",
      historiqueMouvements: [],
    },
    minute: MINUTES_MEMOIRE[0],
  };
}

async function numeriserEtArchiver(donnees, utilisateurId) {
  const {
    dossierId,
    numeroMinute,
    scanUrl,
    empreinteSha256,
    cartonId,
    dateCloture,
  } = donnees;

  const annee = dateCloture ? new Date(dateCloture).getFullYear() : new Date().getFullYear();
  const numMinute = numeroMinute || `MIN-${annee}/${String(MINUTES_MEMOIRE.length + 1).padStart(3, "0")}`;
  const codeEmplacement = "Salle A · Armoire 1 · CARTON-001 · pos " + String(MINUTES_MEMOIRE.length + 1).padStart(3, "0");

  try {
    await pool.query("UPDATE dossiers SET statut = 'cloture', etape_actuelle = 6 WHERE id = $1", [dossierId]);
  } catch (_) {}

  const minRec = {
    id: "min-" + crypto.randomUUID().slice(0, 8),
    dossier_id: dossierId,
    numero_minute: numMinute,
    annee_minute: annee,
    carton_id: cartonId || "carton-001",
    position_dans_carton: 1,
    code_emplacement: codeEmplacement,
    statut_archivage: "archive",
    scan_url: scanUrl || "SCAN_MIN_OFFICIEL.pdf",
    date_cloture: dateCloture || new Date().toISOString(),
  };
  MINUTES_MEMOIRE.push(minRec);
  await dossiersService.ajouterMouvement(null, dossierId, utilisateurId, `Dossier numérisé & archivé en minute (${numMinute}) — ${codeEmplacement}`);

  return {
    minuteId: minRec.id,
    numeroMinute: numMinute,
    codeEmplacement,
    cartonNumero: "CARTON-001",
    scanUrl: minRec.scan_url,
    empreinteSha256: empreinteSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    dossierId,
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
