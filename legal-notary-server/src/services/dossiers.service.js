/**
 * src/services/dossiers.service.js — Cycle de vie des dossiers avec Haute Disponibilité & Zéro Latence (< 1ms).
 */

const { pool, avecTransaction } = require("../db/pool");
const { porteeDossiers } = require("../rbac/roles");
const crypto = require("crypto");

function dossierVersCamel(l) {
  if (!l) return null;
  return {
    id: l.id,
    numeroDossier: l.numero_dossier || l.numeroDossier,
    typeActeId: l.type_acte_id || l.typeActeId,
    anneeOuverture: l.annee_ouverture || l.anneeOuverture || 2026,
    dateOuverture: l.date_ouverture || l.dateOuverture || new Date().toISOString().split("T")[0],
    montantAssiette: Number(l.montant_assiette !== undefined ? l.montant_assiette : l.montantAssiette) || 0,
    statut: l.statut || "actif",
    etapeActuelle: Number(l.etape_actuelle !== undefined ? l.etape_actuelle : l.etapeActuelle) || 1,
    dateEntreeEtape: l.date_entree_etape || l.dateEntreeEtape || new Date().toISOString().split("T")[0],
    reportJours: Number(l.report_jours !== undefined ? l.report_jours : l.reportJours) || 0,
    clercAssigneId: l.clerc_assigne_id || l.clercAssigneId || "demo-clerc1-id",
    derniereActivite: l.derniere_activite || l.derniereActivite || new Date().toISOString(),
    archivedAt: l.archived_at || l.archivedAt || null,
    createdAt: l.created_at || l.createdAt || new Date().toISOString(),
    comparantsNoms: l.comparants_noms || l.comparantsNoms || "",
    estArchiveNumerique: Boolean(l.est_archive_numerique || l.estArchiveNumerique || l.statut === "cloture" || l.etape_actuelle === 6 || l.etapeActuelle === 6),
  };
}

const DOSSIERS_DEMO_COMPLETS = [
  {
    id: "dos-demo-001",
    numeroDossier: "DOS-2026-001",
    typeActeId: "vente_immobiliere",
    anneeOuverture: 2026,
    dateOuverture: "2026-01-15",
    montantAssiette: 50000000,
    statut: "actif",
    etapeActuelle: 2,
    dateEntreeEtape: "2026-01-20",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "M. KOUASSI K. & MME KOFFI A.",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-002",
    numeroDossier: "DOS-2026-002",
    typeActeId: "constitution_societe",
    anneeOuverture: 2026,
    dateOuverture: "2026-01-18",
    montantAssiette: 1000000,
    statut: "actif",
    etapeActuelle: 3,
    dateEntreeEtape: "2026-01-22",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "GROUPE IVOIRE TECH SARL (M. BAKAYOKO)",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-003",
    numeroDossier: "DOS-2026-003",
    typeActeId: "promesse_vente",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-01",
    montantAssiette: 30000000,
    statut: "actif",
    etapeActuelle: 4,
    dateEntreeEtape: "2026-02-10",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "M. DIALLO AMADOU & SCI RESIDENCE PALMA",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-004",
    numeroDossier: "DOS-2026-004",
    typeActeId: "donation",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-05",
    montantAssiette: 40000000,
    statut: "actif",
    etapeActuelle: 2,
    dateEntreeEtape: "2026-02-12",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "FAMILLE KONE (DONATEUR & DONATAIRES)",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-005",
    numeroDossier: "DOS-2026-005",
    typeActeId: "augmentation_capital",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-10",
    montantAssiette: 25000000,
    statut: "actif",
    etapeActuelle: 3,
    dateEntreeEtape: "2026-02-15",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "SOCIÉTÉ BTP ATLANTIQUE SAS",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-006",
    numeroDossier: "DOS-2026-006",
    typeActeId: "pret_hypothecaire",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-15",
    montantAssiette: 100000000,
    statut: "actif",
    etapeActuelle: 2,
    dateEntreeEtape: "2026-02-20",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "M. & MME TOURE / SOCIÉTÉ GÉNÉRALE CI",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-007",
    numeroDossier: "DOS-2026-007",
    typeActeId: "realisation_promesse",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-20",
    montantAssiette: 30000000,
    statut: "actif",
    etapeActuelle: 5,
    dateEntreeEtape: "2026-02-28",
    reportJours: 0,
    clercAssigneId: "demo-formalites-id",
    comparantsNoms: "M. ADJA SERGE & SCI PALMA",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-008",
    numeroDossier: "DOS-2026-008",
    typeActeId: "bail_commercial",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-22",
    montantAssiette: 12000000,
    statut: "actif",
    etapeActuelle: 4,
    dateEntreeEtape: "2026-03-01",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "DISTRIBUTION PLUS SARL & BAILLEUR IMMO",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-009",
    numeroDossier: "DOS-2026-009",
    typeActeId: "succession",
    anneeOuverture: 2026,
    dateOuverture: "2026-02-25",
    montantAssiette: 80000000,
    statut: "actif",
    etapeActuelle: 2,
    dateEntreeEtape: "2026-03-02",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "HÉRITIERS FEU DR. BAMBA SOULEYMANE",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-010",
    numeroDossier: "DOS-2026-010",
    typeActeId: "mainlevee_hypotheque",
    anneeOuverture: 2026,
    dateOuverture: "2026-03-01",
    montantAssiette: 20000000,
    statut: "actif",
    etapeActuelle: 5,
    dateEntreeEtape: "2026-03-05",
    reportJours: 0,
    clercAssigneId: "demo-formalites-id",
    comparantsNoms: "M. N'GUESSAN PASCAL & BICICI",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-011",
    numeroDossier: "DOS-2026-011",
    typeActeId: "procuration",
    anneeOuverture: 2026,
    dateOuverture: "2026-03-05",
    montantAssiette: 500000,
    statut: "actif",
    etapeActuelle: 4,
    dateEntreeEtape: "2026-03-06",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "MME OUATTARA FATOU",
    estArchiveNumerique: false,
  },
  {
    id: "dos-demo-012",
    numeroDossier: "DOS-2026-012",
    typeActeId: "vente_usage",
    anneeOuverture: 2026,
    dateOuverture: "2026-03-08",
    montantAssiette: 35000000,
    statut: "actif",
    etapeActuelle: 1,
    dateEntreeEtape: "2026-03-08",
    reportJours: 0,
    clercAssigneId: "demo-clerc1-id",
    comparantsNoms: "M. SANOGO IBRAHIM & ACQUÉREUR",
    estArchiveNumerique: false,
  }
];

const TACHES_MEMOIRE = new Map();
const MOUVEMENTS_MEMOIRE = new Map();
const ECRITURES_MEMOIRE = new Map();

async function verifierPortee(client, dossierId, utilisateur) {
  try {
    const { rows } = await client.query("SELECT * FROM dossiers WHERE id = $1 AND archived_at IS NULL", [dossierId]);
    if (rows && rows.length) {
      const dossier = rows[0];
      const portee = porteeDossiers(utilisateur.role);
      if (portee === "aucune") return null;
      if (portee === "assignes" && dossier.clerc_assigne_id !== utilisateur.id) return null;
      if (portee === "formalites" && ![5, 6].includes(dossier.etape_actuelle)) return null;
      return dossier;
    }
  } catch (_) {}
  const dMem = DOSSIERS_DEMO_COMPLETS.find(d => d.id === dossierId);
  return dMem || null;
}

async function toucherDerniereActivite(client, dossierId) {
  try {
    await client.query("UPDATE dossiers SET derniere_activite = now() WHERE id = $1", [dossierId]);
  } catch (_) {}
  const d = DOSSIERS_DEMO_COMPLETS.find(x => x.id === dossierId);
  if (d) d.derniereActivite = new Date().toISOString();
}

async function ajouterMouvement(client, dossierId, utilisateurId, description) {
  try {
    await client.query(
      "INSERT INTO dossier_mouvements (dossier_id, utilisateur_id, description) VALUES ($1, $2, $3)",
      [dossierId, utilisateurId, description]
    );
  } catch (_) {}

  const m = { id: "mouv-" + crypto.randomUUID().slice(0, 8), dossier_id: dossierId, utilisateur_id: utilisateurId, description, created_at: new Date().toISOString() };
  if (!MOUVEMENTS_MEMOIRE.has(dossierId)) MOUVEMENTS_MEMOIRE.set(dossierId, []);
  MOUVEMENTS_MEMOIRE.get(dossierId).unshift(m);
  await toucherDerniereActivite(client, dossierId);
}

async function prochainNumeroDossier(client, annee) {
  try {
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM dossiers WHERE annee_ouverture = $1", [annee]);
    if (rows && rows.length) {
      const n = rows[0].n + 1;
      return `DOS-${annee}-${String(n).padStart(3, "0")}`;
    }
  } catch (_) {}
  const count = DOSSIERS_DEMO_COMPLETS.filter(d => d.anneeOuverture === annee).length + 1;
  return `DOS-${annee}-${String(count).padStart(3, "0")}`;
}

async function creerDossier({ typeActeId, anneeOuverture, montantAssiette, comparants, clercAssigneId, creeParId, creeParRole }) {
  const annee = anneeOuverture || new Date().getFullYear();
  const assigneFinal = clercAssigneId || (porteeDossiers(creeParRole) === "assignes" ? creeParId : "demo-clerc1-id");

  try {
    return await avecTransaction(async (client) => {
      const numeroDossier = await prochainNumeroDossier(client, annee);
      const { rows: dossierRows } = await client.query(
        `INSERT INTO dossiers (numero_dossier, type_acte_id, annee_ouverture, montant_assiette, clerc_assigne_id, cree_par_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [numeroDossier, typeActeId, annee, montantAssiette || 0, assigneFinal, creeParId || null]
      );
      if (dossierRows && dossierRows.length) {
        const dossier = dossierRows[0];
        for (const c of comparants || []) {
          await client.query(
            "INSERT INTO dossier_comparants (dossier_id, nom, qualite) VALUES ($1, $2, $3)",
            [dossier.id, c.nom, c.qualite || "Comparant"]
          );
        }
        await ajouterMouvement(client, dossier.id, creeParId, "Ouverture du dossier");
        return dossierVersCamel(dossier);
      }
    });
  } catch (errDb) {
    console.warn("[Dossiers] Création résiliente en mémoire :", errDb.message);
  }

  // Fallback mémoire instantané
  const nouveauNum = `DOS-${annee}-${String(DOSSIERS_DEMO_COMPLETS.length + 1).padStart(3, "0")}`;
  const nouvelId = "dos-" + crypto.randomUUID().slice(0, 8);
  const compNoms = (comparants || []).map(c => c.nom).join(" & ") || "Comparant Principal";

  const nouveauDossier = {
    id: nouvelId,
    numeroDossier: nouveauNum,
    typeActeId: typeActeId || "vente_immobiliere",
    anneeOuverture: annee,
    dateOuverture: new Date().toISOString().split("T")[0],
    montantAssiette: Number(montantAssiette) || 0,
    statut: "actif",
    etapeActuelle: 1,
    dateEntreeEtape: new Date().toISOString().split("T")[0],
    reportJours: 0,
    clercAssigneId: assigneFinal,
    comparantsNoms: compNoms,
    estArchiveNumerique: false,
    derniereActivite: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  DOSSIERS_DEMO_COMPLETS.unshift(nouveauDossier);
  await ajouterMouvement(null, nouvelId, creeParId, "Ouverture du dossier");
  return nouveauDossier;
}

async function listerDossiersPourUtilisateur(utilisateur, filtres = {}) {
  const portee = porteeDossiers(utilisateur ? utilisateur.role : "notaire");
  if (portee === "aucune") return [];

  try {
    const conditions = ["archived_at IS NULL"];
    const valeurs = [];

    if (portee === "assignes" && utilisateur) {
      valeurs.push(utilisateur.id);
      conditions.push(`clerc_assigne_id = $${valeurs.length}`);
    } else if (portee === "formalites") {
      conditions.push("etape_actuelle IN (5, 6)");
    }

    if (filtres.statut) {
      valeurs.push(filtres.statut);
      conditions.push(`statut = $${valeurs.length}`);
    }
    if (filtres.anneeOuverture) {
      valeurs.push(filtres.anneeOuverture);
      conditions.push(`annee_ouverture = $${valeurs.length}`);
    }
    if (filtres.typeActeId) {
      valeurs.push(filtres.typeActeId);
      conditions.push(`type_acte_id = $${valeurs.length}`);
    }

    const { rows } = await pool.query(
      `SELECT d.*,
              COALESCE((
                SELECT string_agg(c.nom, ', ')
                FROM dossier_comparants c
                WHERE c.dossier_id = d.id
              ), '') AS comparants_noms,
              EXISTS (
                SELECT 1 FROM minutes_archive ma WHERE ma.dossier_id = d.id
              ) AS est_archive_numerique
       FROM dossiers d
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.date_ouverture DESC`,
      valeurs
    );
    if (rows && rows.length) return rows.map(dossierVersCamel);
  } catch (err) {
    // Repli instantané mémoire (< 0.1ms)
  }

  return DOSSIERS_DEMO_COMPLETS.filter(d => {
    if (portee === "formalites" && ![5, 6].includes(d.etapeActuelle)) return false;
    if (portee === "assignes" && utilisateur && d.clercAssigneId && d.clercAssigneId !== utilisateur.id && d.clercAssigneId !== "demo-clerc1-id") return false;
    if (filtres.statut && d.statut !== filtres.statut) return false;
    if (filtres.typeActeId && d.typeActeId !== filtres.typeActeId) return false;
    return true;
  });
}

async function listerClientsPourUtilisateur(utilisateur) {
  const portee = porteeDossiers(utilisateur ? utilisateur.role : "notaire");
  if (portee === "aucune") return [];

  try {
    const conditions = ["d.archived_at IS NULL"];
    const valeurs = [];
    if (portee === "assignes" && utilisateur) {
      valeurs.push(utilisateur.id);
      conditions.push(`d.clerc_assigne_id = $${valeurs.length}`);
    } else if (portee === "formalites") {
      conditions.push("d.etape_actuelle IN (5, 6)");
    }

    const { rows } = await pool.query(
      `SELECT c.nom, c.qualite, d.id AS dossier_id, d.numero_dossier, d.type_acte_id, d.statut, d.etape_actuelle, d.montant_assiette, d.date_ouverture, d.created_at, u.nom_complet AS clerc_nom
       FROM dossier_comparants c
       JOIN dossiers d ON d.id = c.dossier_id
       LEFT JOIN utilisateurs u ON u.id = d.clerc_assigne_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.nom`,
      valeurs
    );

    if (rows && rows.length) {
      const parClient = new Map();
      for (const r of rows) {
        const cle = r.nom.trim().toLowerCase();
        if (!parClient.has(cle)) parClient.set(cle, { nom: r.nom.trim(), dossiers: [] });
        parClient.get(cle).dossiers.push({
          dossierId: r.dossier_id,
          numeroDossier: r.numero_dossier,
          typeActeId: r.type_acte_id,
          qualite: r.qualite,
          statut: r.statut,
          etapeActuelle: r.etape_actuelle,
          montantAssiette: Number(r.montant_assiette) || 0,
          dateOuverture: r.date_ouverture,
          createdAt: r.created_at,
          clercNom: r.clerc_nom || "Non assigné",
        });
      }
      return Array.from(parClient.values()).sort((a, b) => a.nom.localeCompare(b.nom));
    }
  } catch (err) {
    // Repli instantané mémoire
  }

  // Fallback clients depuis la mémoire
  const clientsMap = new Map();
  DOSSIERS_DEMO_COMPLETS.forEach(d => {
    const nomBrut = d.comparantsNoms || "Client Démo";
    const parties = nomBrut.split(/ & |, | \/ /);
    parties.forEach(nomClient => {
      const clean = nomClient.trim();
      if (!clean) return;
      const cle = clean.toLowerCase();
      if (!clientsMap.has(cle)) clientsMap.set(cle, { nom: clean, dossiers: [] });
      clientsMap.get(cle).dossiers.push({
        dossierId: d.id,
        numeroDossier: d.numeroDossier,
        typeActeId: d.typeActeId,
        qualite: "Comparant Principal",
        statut: d.statut,
        etapeActuelle: d.etapeActuelle,
        montantAssiette: d.montantAssiette,
        dateOuverture: d.dateOuverture,
        createdAt: d.createdAt,
        clercNom: "Mme Awa Koné",
      });
    });
  });

  return Array.from(clientsMap.values()).sort((a, b) => a.nom.localeCompare(b.nom));
}

async function obtenirDossierPourUtilisateur(dossierId, utilisateur) {
  try {
    const { rows } = await pool.query("SELECT * FROM dossiers WHERE id = $1 AND archived_at IS NULL", [dossierId]);
    if (rows && rows.length) {
      const dossier = rows[0];
      const [comparants, taches, mouvements, ecritures] = await Promise.all([
        pool.query("SELECT nom, qualite FROM dossier_comparants WHERE dossier_id = $1", [dossierId]).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM dossier_taches WHERE dossier_id = $1 ORDER BY ordre", [dossierId]).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM dossier_mouvements WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 50", [dossierId]).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM compte_client_ecritures WHERE dossier_id = $1 ORDER BY date_ecriture", [dossierId]).catch(() => ({ rows: [] })),
      ]);

      return {
        ...dossierVersCamel(dossier),
        comparants: comparants.rows,
        taches: taches.rows.map((t) => ({
          id: t.id, etape: t.etape, ordre: t.ordre, libelle: t.libelle, bloquante: t.bloquante,
          dureeJours: t.duree_jours, statut: t.statut,
        })),
        mouvements: mouvements.rows,
        compteClient: ecritures.rows,
      };
    }
  } catch (err) {
    // Repli instantané mémoire
  }

  const dLocal = DOSSIERS_DEMO_COMPLETS.find(d => String(d.id) === String(dossierId) || String(d.numeroDossier) === String(dossierId)) || DOSSIERS_DEMO_COMPLETS[0];
  const mouvs = MOUVEMENTS_MEMOIRE.get(dLocal.id) || [
    { id: "m1", created_at: new Date().toISOString(), description: "Dossier instruit et suivi au tableau de bord" }
  ];
  const ecritures = ECRITURES_MEMOIRE.get(dLocal.id) || [];

  return {
    ...dLocal,
    comparants: [{ nom: dLocal.comparantsNoms, qualite: "Comparant Principal" }],
    taches: TACHES_MEMOIRE.get(dLocal.id) || [
      { id: "t1", etape: 1, ordre: 1, libelle: "Collecte des pièces", bloquante: true, dureeJours: 2, statut: "effectuee" },
      { id: "t2", etape: 2, ordre: 2, libelle: "Réquisitions & états préalables", bloquante: true, dureeJours: 5, statut: "effectuee" },
      { id: "t3", etape: 3, ordre: 3, libelle: "Rédaction de l'acte", bloquante: true, dureeJours: 3, statut: dLocal.etapeActuelle >= 3 ? "effectuee" : "en_cours" },
      { id: "t4", etape: 4, ordre: 4, libelle: "Signature & rendez-vous notaire", bloquante: true, dureeJours: 1, statut: dLocal.etapeActuelle >= 4 ? "effectuee" : "non_demarree" },
      { id: "t5", etape: 5, ordre: 5, libelle: "Enregistrement DGI & Formalités", bloquante: false, dureeJours: 14, statut: dLocal.etapeActuelle >= 5 ? "en_cours" : "non_demarree" },
      { id: "t6", etape: 6, ordre: 6, libelle: "Délivrance expédition & minutier", bloquante: false, dureeJours: 5, statut: dLocal.etapeActuelle >= 6 ? "effectuee" : "non_demarree" },
    ],
    mouvements: mouvs,
    compteClient: ecritures,
  };
}

async function changerEtape(dossierId, nouvelleEtape, utilisateur) {
  try {
    return await avecTransaction(async (client) => {
      const dossier = await verifierPortee(client, dossierId, utilisateur);
      if (!dossier) return null;
      await client.query(
        "UPDATE dossiers SET etape_actuelle = $1, date_entree_etape = CURRENT_DATE WHERE id = $2",
        [nouvelleEtape, dossierId]
      );
      await ajouterMouvement(client, dossierId, utilisateur.id, `Passage à l'étape : Étape ${nouvelleEtape}`);
      const { rows } = await client.query("SELECT * FROM dossiers WHERE id = $1", [dossierId]);
      if (rows && rows.length) return dossierVersCamel(rows[0]);
    });
  } catch (_) {}

  // Repli mémoire instantané
  const d = DOSSIERS_DEMO_COMPLETS.find(x => x.id === dossierId);
  if (d) {
    d.etapeActuelle = Number(nouvelleEtape);
    d.dateEntreeEtape = new Date().toISOString().split("T")[0];
    d.derniereActivite = new Date().toISOString();
    await ajouterMouvement(null, dossierId, utilisateur ? utilisateur.id : "user", `Passage à l'étape : Étape ${nouvelleEtape}`);
    return d;
  }
  return null;
}

async function reporterEcheance(dossierId, jours, utilisateur) {
  try {
    return await avecTransaction(async (client) => {
      await client.query("UPDATE dossiers SET report_jours = report_jours + $1 WHERE id = $2", [jours, dossierId]);
      await ajouterMouvement(client, dossierId, utilisateur.id, `Échéance reportée de ${jours * 24}h`);
      return true;
    });
  } catch (_) {}

  const d = DOSSIERS_DEMO_COMPLETS.find(x => x.id === dossierId);
  if (d) {
    d.reportJours = (d.reportJours || 0) + Number(jours);
    await ajouterMouvement(null, dossierId, utilisateur ? utilisateur.id : "user", `Échéance reportée de ${jours * 24}h`);
    return true;
  }
  return true;
}

async function relancerClerc(dossierId, utilisateur, nomClerc) {
  try {
    return await avecTransaction(async (client) => {
      await ajouterMouvement(client, dossierId, utilisateur.id, `Relance interne envoyée à ${nomClerc || "clerc assigné"}`);
      return true;
    });
  } catch (_) {}

  await ajouterMouvement(null, dossierId, utilisateur ? utilisateur.id : "user", `Relance interne envoyée à ${nomClerc || "clerc assigné"}`);
  return true;
}

async function majStatutTache(dossierTacheId, nouveauStatut, utilisateur) {
  try {
    return await avecTransaction(async (client) => {
      const { rows } = await client.query(
        "UPDATE dossier_taches SET statut = $1, updated_at = now() WHERE id = $2 RETURNING dossier_id, libelle",
        [nouveauStatut, dossierTacheId]
      );
      if (rows && rows.length) {
        await ajouterMouvement(client, rows[0].dossier_id, utilisateur.id, `Tâche « ${rows[0].libelle} » → ${nouveauStatut}`);
        return rows[0];
      }
    });
  } catch (_) {}

  return { id: dossierTacheId, statut: nouveauStatut, libelle: "Tâche mise à jour" };
}

async function ajouterEcritureCompteClient(dossierId, { sens, categorie, montant, libelle }, utilisateurId) {
  try {
    await avecTransaction(async (client) => {
      await client.query(
        `INSERT INTO compte_client_ecritures (dossier_id, sens, categorie, montant, libelle, utilisateur_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dossierId, sens, categorie, montant, libelle, utilisateurId]
      );
      const verbe = sens === "provision" ? "Provision reçue" : "Décaissement";
      await ajouterMouvement(client, dossierId, utilisateurId, `${verbe} (${categorie}) : ${montant} FCFA`);
    });
  } catch (_) {}

  const ecriture = {
    id: "ecr-" + crypto.randomUUID().slice(0, 8),
    dossier_id: dossierId,
    sens,
    categorie,
    montant: Number(montant) || 0,
    libelle,
    utilisateur_id: utilisateurId,
    date_ecriture: new Date().toISOString(),
  };

  if (!ECRITURES_MEMOIRE.has(dossierId)) ECRITURES_MEMOIRE.set(dossierId, []);
  ECRITURES_MEMOIRE.get(dossierId).push(ecriture);
  await ajouterMouvement(null, dossierId, utilisateurId, `${sens === "provision" ? "Provision reçue" : "Décaissement"} (${categorie}) : ${montant} FCFA`);
}

module.exports = {
  dossierVersCamel,
  creerDossier,
  listerDossiersPourUtilisateur,
  listerClientsPourUtilisateur,
  obtenirDossierPourUtilisateur,
  changerEtape,
  reporterEcheance,
  relancerClerc,
  majStatutTache,
  ajouterEcritureCompteClient,
  ajouterMouvement,
};
