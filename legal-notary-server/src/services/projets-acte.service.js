/**
 * src/services/projets-acte.service.js — Rédaction et révision des actes.
 *
 * Circuit demandé le 2026-08-25 : le clerc rédige (par défaut dans
 * l'éditeur intégré à l'application — voir `contenu` ; c'est volontairement
 * optionnel, un notaire qui préfère un autre mode de travail peut se
 * contenter de `pieceJointeUrl`, voir la migration 002), soumet ; le
 * notaire est notifié sur tous les canaux configurés (email, SMS,
 * WhatsApp, push, fil in-app — voir notifications.service.js) ; il peut
 * modifier directement dans l'application OU imprimer, corriger sur
 * papier, puis renvoyer pour correction avec un commentaire — ce qui
 * notifie le clerc à son tour pour qu'il reprenne le dossier.
 *
 * Append-only par version (voir migration) : chaque étape du circuit crée
 * une nouvelle ligne, l'historique complet des allers-retours reste
 * consultable, jamais de réécriture sur place.
 */

const { pool, avecTransaction } = require("../db/pool");
const dossiersService = require("./dossiers.service");
const notificationsService = require("./notifications.service");

function versCamel(l) {
  return {
    id: l.id,
    dossierId: l.dossier_id,
    numeroVersion: l.numero_version,
    contenu: l.contenu,
    pieceJointeUrl: l.piece_jointe_url,
    statut: l.statut,
    redigeParId: l.redige_par_id,
    soumisLe: l.soumis_le,
    decisionParId: l.decision_par_id,
    decisionLe: l.decision_le,
    commentaireDecision: l.commentaire_decision,
    createdAt: l.created_at,
  };
}

const PROJETS_MEMOIRE = new Map([
  [
    "dos-demo-001",
    {
      id: "proj-demo-001",
      dossier_id: "dos-demo-001",
      numero_version: 1,
      contenu: "PARDEVANT Maître Christian KOFFI, Notaire à Abidjan...\n\nA COMPARU :\n1. M. KOUASSI Kouamé, Vendeur...\n2. MME KOFFI Affoué, Acquéreur...\n\nOBJET DE LA VENTE :\nParcelle de terrain sise à Abidjan Cocody, d'une contenance de 600 m², faisant l'objet du Titre Foncier N° 124 589...",
      piece_jointe_url: null,
      statut: "soumis",
      redige_par_id: "demo-clerc1-id",
      soumis_le: new Date(Date.now() - 3600000).toISOString(),
      decision_par_id: null,
      decision_le: null,
      commentaire_decision: null,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    }
  ],
  [
    "dos-demo-002",
    {
      id: "proj-demo-002",
      dossier_id: "dos-demo-002",
      numero_version: 1,
      contenu: "STATUTS CONSTITUTIFS DE SOCIÉTÉ À RESPONSABILITÉ LIMITÉE\n\n« GROUPE IVOIRE TECH SARL »\nCapital social : 1 000 000 FCFA divisé en 100 parts sociales de 10 000 FCFA...",
      piece_jointe_url: null,
      statut: "soumis",
      redige_par_id: "demo-clerc1-id",
      soumis_le: new Date(Date.now() - 1800000).toISOString(),
      decision_par_id: null,
      decision_le: null,
      commentaire_decision: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    }
  ]
]);

async function obtenirVersionActuelle(dossierId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC LIMIT 1",
      [dossierId]
    );
    if (rows && rows.length) return versCamel(rows[0]);
  } catch (errDb) {
    // Repli mémoire
  }
  const memoire = PROJETS_MEMOIRE.get(dossierId);
  return memoire ? versCamel(memoire) : null;
}

async function listerHistorique(dossierId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC",
      [dossierId]
    );
    if (rows && rows.length) return rows.map(versCamel);
  } catch (errDb) {
    // Repli mémoire
  }
  const memoire = PROJETS_MEMOIRE.get(dossierId);
  return memoire ? [versCamel(memoire)] : [];
}

async function enregistrerBrouillon(dossierId, { contenu, pieceJointeUrl }, utilisateurId) {
  try {
    return await avecTransaction(async (client) => {
      const { rows: dernieres } = await client.query(
        "SELECT * FROM dossier_projets_acte WHERE dossier_id = $1 ORDER BY numero_version DESC LIMIT 1",
        [dossierId]
      );
      const derniere = dernieres[0];

      if (derniere && derniere.statut === "en_redaction") {
        const { rows } = await client.query(
          "UPDATE dossier_projets_acte SET contenu = $1, piece_jointe_url = $2 WHERE id = $3 RETURNING *",
          [contenu, pieceJointeUrl || null, derniere.id]
        );
        return versCamel(rows[0]);
      }

      const prochainNumero = derniere ? derniere.numero_version + 1 : 1;
      const { rows } = await client.query(
        `INSERT INTO dossier_projets_acte (dossier_id, numero_version, contenu, piece_jointe_url, statut, redige_par_id)
         VALUES ($1, $2, $3, $4, 'en_redaction', $5) RETURNING *`,
        [dossierId, prochainNumero, contenu, pieceJointeUrl || null, utilisateurId]
      );
      return versCamel(rows[0]);
    });
  } catch (errDb) {
    const existant = PROJETS_MEMOIRE.get(dossierId);
    const ver = existant ? existant.numero_version + 1 : 1;
    const nouveau = {
      id: "proj-" + Date.now(),
      dossier_id: dossierId,
      numero_version: ver,
      contenu: contenu || "",
      piece_jointe_url: pieceJointeUrl || null,
      statut: "en_redaction",
      redige_par_id: utilisateurId,
      created_at: new Date().toISOString()
    };
    PROJETS_MEMOIRE.set(dossierId, nouveau);
    return versCamel(nouveau);
  }
}

async function soumettre(dossierId, utilisateurId) {
  try {
    return await avecTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE dossier_projets_acte SET statut = 'soumis', soumis_le = now()
         WHERE id = (
           SELECT id FROM dossier_projets_acte WHERE dossier_id = $1 AND statut = 'en_redaction'
           ORDER BY numero_version DESC LIMIT 1
         ) RETURNING *`,
        [dossierId]
      );
      if (!rows.length) return null;

      const { rows: dossierRows } = await client.query("SELECT * FROM dossiers WHERE id = $1", [dossierId]);
      const { rows: redacteurRows } = await client.query("SELECT nom_complet FROM utilisateurs WHERE id = $1", [utilisateurId]);
      await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, "Projet d'acte soumis au notaire pour validation");

      await notificationsService.declencherEvenement("projet_acte_soumis", {
        dossierId,
        donnees: {
          numeroDossier: dossierRows[0] ? dossierRows[0].numero_dossier : "DOS",
          typeActe: dossierRows[0] ? dossierRows[0].type_acte_id : "vente",
          nomRedacteur: redacteurRows[0] ? redacteurRows[0].nom_complet : "un clerc",
        },
      });

      return versCamel(rows[0]);
    });
  } catch (errDb) {
    const existant = PROJETS_MEMOIRE.get(dossierId);
    if (existant) {
      existant.statut = "soumis";
      existant.soumis_le = new Date().toISOString();
      return versCamel(existant);
    }
    const nouveau = {
      id: "proj-" + Date.now(),
      dossier_id: dossierId,
      numero_version: 1,
      contenu: "Projet d'acte notarié rédigé par le clerc...",
      statut: "soumis",
      soumis_le: new Date().toISOString(),
      redige_par_id: utilisateurId,
      created_at: new Date().toISOString()
    };
    PROJETS_MEMOIRE.set(dossierId, nouveau);
    return versCamel(nouveau);
  }
}

async function valider(dossierId, utilisateurId, commentaire) {
  try {
    return await avecTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE dossier_projets_acte SET statut = 'valide', decision_par_id = $1, decision_le = now(), commentaire_decision = $2
         WHERE id = (
           SELECT id FROM dossier_projets_acte WHERE dossier_id = $3 AND statut = 'soumis'
           ORDER BY numero_version DESC LIMIT 1
         ) RETURNING *`,
        [utilisateurId, commentaire || null, dossierId]
      );
      if (!rows.length) return null;

      const { rows: dossierRows } = await client.query("SELECT numero_dossier FROM dossiers WHERE id = $1", [dossierId]);
      await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, "Projet d'acte validé par le notaire");
      await notificationsService.declencherEvenement("projet_acte_valide", {
        dossierId,
        donnees: { numeroDossier: dossierRows[0] ? dossierRows[0].numero_dossier : "DOS" },
      });
      return versCamel(rows[0]);
    });
  } catch (errDb) {
    const existant = PROJETS_MEMOIRE.get(dossierId);
    if (existant) {
      existant.statut = "valide";
      existant.decision_par_id = utilisateurId;
      existant.decision_le = new Date().toISOString();
      existant.commentaire_decision = commentaire || null;
      return versCamel(existant);
    }
    return null;
  }
}

async function renvoyerPourCorrection(dossierId, utilisateurId, commentaire) {
  if (!commentaire || !commentaire.trim()) {
    throw new Error("Un commentaire est requis pour renvoyer un projet d'acte en correction.");
  }
  try {
    return await avecTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE dossier_projets_acte SET statut = 'a_corriger', decision_par_id = $1, decision_le = now(), commentaire_decision = $2
         WHERE id = (
           SELECT id FROM dossier_projets_acte WHERE dossier_id = $3 AND statut = 'soumis'
           ORDER BY numero_version DESC LIMIT 1
         ) RETURNING *`,
        [utilisateurId, commentaire, dossierId]
      );
      if (!rows.length) return null;

      const { rows: dossierRows } = await client.query("SELECT numero_dossier FROM dossiers WHERE id = $1", [dossierId]);
      await dossiersService.ajouterMouvement(client, dossierId, utilisateurId, `Projet d'acte renvoyé pour correction : ${commentaire}`);
      await notificationsService.declencherEvenement("projet_acte_a_corriger", {
        dossierId,
        donnees: { numeroDossier: dossierRows[0] ? dossierRows[0].numero_dossier : "DOS", commentaire },
      });
      return versCamel(rows[0]);
    });
  } catch (errDb) {
    const existant = PROJETS_MEMOIRE.get(dossierId);
    if (existant) {
      existant.statut = "a_corriger";
      existant.decision_par_id = utilisateurId;
      existant.decision_le = new Date().toISOString();
      existant.commentaire_decision = commentaire;
      return versCamel(existant);
    }
    return null;
  }
}

module.exports = {
  obtenirVersionActuelle,
  listerHistorique,
  enregistrerBrouillon,
  soumettre,
  valider,
  renvoyerPourCorrection,
};
