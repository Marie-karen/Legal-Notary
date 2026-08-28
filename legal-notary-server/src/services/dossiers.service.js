/**
 * src/services/dossiers.service.js — Cycle de vie des dossiers.
 *
 * Point important : le filtrage RBAC (qui a le droit de VOIR quels
 * dossiers) est appliqué ICI, dans la clause SQL, pas seulement dans les
 * routes API ni côté frontend — un filtrage uniquement visuel ne protège
 * rien puisqu'un client HTTP direct pourrait interroger l'API sans passer
 * par l'interface. Voir src/rbac/roles.js#porteeDossiers pour la règle de
 * portée par rôle, et docs/RBAC.md pour la justification métier de chaque
 * vue (assistante/clerc/formaliste/comptable/notaire ne voient jamais
 * exactement la même chose).
 *
 * Aucune suppression physique : archiverDossier() renseigne archived_at,
 * ne supprime jamais la ligne (voir migrations/001_schema_initial.sql).
 */

const { pool, avecTransaction } = require("../db/pool");
const { porteeDossiers } = require("../rbac/roles");
const referentiel = require("./referentiel.service");

function dossierVersCamel(l) {
  return {
    id: l.id,
    numeroDossier: l.numero_dossier,
    typeActeId: l.type_acte_id,
    anneeOuverture: l.annee_ouverture,
    dateOuverture: l.date_ouverture,
    montantAssiette: Number(l.montant_assiette),
    statut: l.statut,
    etapeActuelle: l.etape_actuelle,
    dateEntreeEtape: l.date_entree_etape,
    reportJours: l.report_jours,
    clercAssigneId: l.clerc_assigne_id,
    derniereActivite: l.derniere_activite,
    archivedAt: l.archived_at,
    createdAt: l.created_at,
    comparantsNoms: l.comparants_noms || "",
    estArchiveNumerique: Boolean(l.est_archive_numerique || l.statut === "cloture" || l.etape_actuelle === 6),
  };
}

/**
 * Vérifie qu'un utilisateur a la portée RBAC pour AGIR sur ce dossier
 * précis (pas seulement la permission d'action générique) — sans ce
 * contrôle, un clerc rédacteur (portée "assignes") pourrait modifier
 * l'étape ou les tâches d'un dossier qui ne lui est pas assigné en
 * devinant/énumérant simplement son identifiant. Renvoie la ligne du
 * dossier (snake_case) si autorisé, `null` sinon — les fonctions
 * appelantes traitent `null` comme "dossier introuvable" (404), jamais
 * "accès refusé" (403), pour ne pas révéler qu'un dossier existe à
 * quelqu'un qui n'a pas le droit de le consulter (même principe que
 * obtenirDossierPourUtilisateur ci-dessous).
 */
async function verifierPortee(client, dossierId, utilisateur) {
  const { rows } = await client.query("SELECT * FROM dossiers WHERE id = $1 AND archived_at IS NULL", [dossierId]);
  if (!rows.length) return null;
  const dossier = rows[0];
  const portee = porteeDossiers(utilisateur.role);
  if (portee === "aucune") return null;
  if (portee === "assignes" && dossier.clerc_assigne_id !== utilisateur.id) return null;
  if (portee === "formalites" && ![5, 6].includes(dossier.etape_actuelle)) return null;
  return dossier;
}

async function toucherDerniereActivite(client, dossierId) {
  await client.query("UPDATE dossiers SET derniere_activite = now() WHERE id = $1", [dossierId]);
}

async function ajouterMouvement(client, dossierId, utilisateurId, description) {
  await client.query(
    "INSERT INTO dossier_mouvements (dossier_id, utilisateur_id, description) VALUES ($1, $2, $3)",
    [dossierId, utilisateurId, description]
  );
  await toucherDerniereActivite(client, dossierId);
}

/**
 * Génère le prochain numéro de dossier séquentiel pour une année donnée
 * (DOS-2026-001, DOS-2026-002, ...). Calculé à partir du compte existant,
 * jamais d'un compteur global partagé entre années.
 */
async function prochainNumeroDossier(client, annee) {
  const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM dossiers WHERE annee_ouverture = $1", [annee]);
  const n = rows[0].n + 1;
  return `DOS-${annee}-${String(n).padStart(3, "0")}`;
}

/**
 * Crée un dossier et sa checklist (copiée depuis le référentiel au moment
 * de la création — voir le commentaire sur dossier_taches dans la
 * migration pour la justification).
 */
async function creerDossier({ typeActeId, anneeOuverture, montantAssiette, comparants, clercAssigneId, creeParId, creeParRole }) {
  return avecTransaction(async (client) => {
    const annee = anneeOuverture || new Date().getFullYear();
    const numeroDossier = await prochainNumeroDossier(client, annee);

    // Un créateur dont la portée est "assignes" (clerc rédacteur,
    // assistante) ne voit ensuite que les dossiers qui lui sont assignés
    // (voir listerDossiersPourUtilisateur) — sans ce repli, un dossier
    // créé sans assignation explicite deviendrait invisible pour son
    // propre créateur juste après la création.
    const assigneFinal = clercAssigneId || (porteeDossiers(creeParRole) === "assignes" ? creeParId : null);

    const { rows: dossierRows } = await client.query(
      `INSERT INTO dossiers (numero_dossier, type_acte_id, annee_ouverture, montant_assiette, clerc_assigne_id, cree_par_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [numeroDossier, typeActeId, annee, montantAssiette || 0, assigneFinal, creeParId || null]
    );
    const dossier = dossierRows[0];

    for (const c of comparants || []) {
      await client.query(
        "INSERT INTO dossier_comparants (dossier_id, nom, qualite) VALUES ($1, $2, $3)",
        [dossier.id, c.nom, c.qualite || "Comparant"]
      );
    }

    const tachesStandard = await client.query(
      "SELECT * FROM taches_standard WHERE type_acte_id = $1 AND archived_at IS NULL ORDER BY ordre",
      [typeActeId]
    );
    for (const t of tachesStandard.rows) {
      await client.query(
        `INSERT INTO dossier_taches (dossier_id, tache_standard_id, etape, ordre, libelle, bloquante, duree_jours)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [dossier.id, t.id, t.etape, t.ordre, t.libelle, t.bloquante, t.duree_jours]
      );
    }

    await ajouterMouvement(client, dossier.id, creeParId, "Ouverture du dossier");
    return dossierVersCamel(dossier);
  });
}

/**
 * Liste les dossiers visibles par un utilisateur donné, selon la portée
 * RBAC de son rôle (voir src/rbac/roles.js#porteeDossiers). C'est le SEUL
 * point d'entrée de lecture de liste utilisé par les routes API — aucune
 * route ne doit interroger `dossiers` directement sans passer par ici.
 */
async function listerDossiersPourUtilisateur(utilisateur, filtres = {}) {
  const portee = porteeDossiers(utilisateur.role);
  if (portee === "aucune") return [];

  const conditions = ["archived_at IS NULL"];
  const valeurs = [];

  if (portee === "assignes") {
    valeurs.push(utilisateur.id);
    conditions.push(`clerc_assigne_id = $${valeurs.length}`);
  } else if (portee === "formalites") {
    conditions.push("etape_actuelle IN (5, 6)");
  }
  // portee === "tous" => pas de condition supplémentaire

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
  return rows.map(dossierVersCamel);
}

/**
 * Annuaire des clients (comparants), agrégés depuis les dossiers dans la
 * portée RBAC de l'utilisateur (même règle que listerDossiersPourUtilisateur
 * ci-dessus — un clerc rédacteur ne voit que les clients de SES dossiers
 * assignés, pas tout le cabinet).
 *
 * Regroupement par nom normalisé (espaces/casse) — il n'existe pas
 * d'identifiant client unique dans ce modèle v1 (un comparant n'a qu'un
 * nom et une qualité, voir migrations/001_schema_initial.sql). Deux
 * personnes homonymes apparaîtront donc regroupées sous une seule entrée
 * ici : limitation connue, à documenter dans NOTES_HYPOTHESES.md plutôt
 * que résolue en inventant une règle de désambiguïsation non demandée.
 */
async function listerClientsPourUtilisateur(utilisateur) {
  const portee = porteeDossiers(utilisateur.role);
  if (portee === "aucune") return [];

  const conditions = ["d.archived_at IS NULL"];
  const valeurs = [];
  if (portee === "assignes") {
    valeurs.push(utilisateur.id);
    conditions.push(`d.clerc_assigne_id = $${valeurs.length}`);
  } else if (portee === "formalites") {
    conditions.push("d.etape_actuelle IN (5, 6)");
  }
  // portee === "tous" => pas de condition supplémentaire

  const { rows } = await pool.query(
    `SELECT c.nom, c.qualite, d.id AS dossier_id, d.numero_dossier, d.type_acte_id, d.statut, d.etape_actuelle, d.montant_assiette, d.date_ouverture, d.created_at, u.nom_complet AS clerc_nom
     FROM dossier_comparants c
     JOIN dossiers d ON d.id = c.dossier_id
     LEFT JOIN utilisateurs u ON u.id = d.clerc_assigne_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.nom`,
    valeurs
  );

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

/**
 * Charge un dossier avec vérification d'accès RBAC. Renvoie `null` si le
 * dossier n'existe pas OU si l'utilisateur n'a pas la portée pour le voir
 * — volontairement la même réponse dans les deux cas (ne pas révéler
 * qu'un dossier existe à quelqu'un qui n'a pas le droit de le consulter).
 */
async function obtenirDossierPourUtilisateur(dossierId, utilisateur) {
  const { rows } = await pool.query("SELECT * FROM dossiers WHERE id = $1 AND archived_at IS NULL", [dossierId]);
  if (!rows.length) return null;
  const dossier = rows[0];

  const portee = porteeDossiers(utilisateur.role);
  if (portee === "aucune") return null;
  if (portee === "assignes" && dossier.clerc_assigne_id !== utilisateur.id) return null;
  if (portee === "formalites" && ![5, 6].includes(dossier.etape_actuelle)) return null;

  const [comparants, taches, mouvements, ecritures] = await Promise.all([
    pool.query("SELECT nom, qualite FROM dossier_comparants WHERE dossier_id = $1", [dossierId]),
    pool.query("SELECT * FROM dossier_taches WHERE dossier_id = $1 ORDER BY ordre", [dossierId]),
    pool.query("SELECT * FROM dossier_mouvements WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 50", [dossierId]),
    pool.query("SELECT * FROM compte_client_ecritures WHERE dossier_id = $1 ORDER BY date_ecriture", [dossierId]),
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

async function changerEtape(dossierId, nouvelleEtape, utilisateur) {
  return avecTransaction(async (client) => {
    const dossier = await verifierPortee(client, dossierId, utilisateur);
    if (!dossier) return null;
    await client.query(
      "UPDATE dossiers SET etape_actuelle = $1, date_entree_etape = CURRENT_DATE WHERE id = $2",
      [nouvelleEtape, dossierId]
    );
    const { rows: etapeRows } = await client.query("SELECT libelle FROM etapes_pipeline WHERE id = $1", [nouvelleEtape]);
    const libelleEtape = etapeRows.length ? etapeRows[0].libelle : nouvelleEtape;
    await ajouterMouvement(client, dossierId, utilisateur.id, `Passage à l'étape : ${libelleEtape}`);
    const { rows } = await client.query("SELECT * FROM dossiers WHERE id = $1", [dossierId]);
    return dossierVersCamel(rows[0]);
  });
}

async function reporterEcheance(dossierId, jours, utilisateur) {
  return avecTransaction(async (client) => {
    const dossier = await verifierPortee(client, dossierId, utilisateur);
    if (!dossier) return null;
    await client.query("UPDATE dossiers SET report_jours = report_jours + $1 WHERE id = $2", [jours, dossierId]);
    await ajouterMouvement(client, dossierId, utilisateur.id, `Échéance reportée de ${jours * 24}h`);
    return true;
  });
}

async function relancerClerc(dossierId, utilisateur, nomClerc) {
  return avecTransaction(async (client) => {
    const dossier = await verifierPortee(client, dossierId, utilisateur);
    if (!dossier) return null;
    await ajouterMouvement(client, dossierId, utilisateur.id, `Relance interne envoyée à ${nomClerc || "clerc assigné"}`);
    return true;
  });
}

async function majStatutTache(dossierTacheId, nouveauStatut, utilisateur) {
  return avecTransaction(async (client) => {
    const { rows: tacheRows } = await client.query("SELECT dossier_id FROM dossier_taches WHERE id = $1", [dossierTacheId]);
    if (!tacheRows.length) return null;
    const dossier = await verifierPortee(client, tacheRows[0].dossier_id, utilisateur);
    if (!dossier) return null;

    const { rows } = await client.query(
      "UPDATE dossier_taches SET statut = $1, updated_at = now() WHERE id = $2 RETURNING dossier_id, libelle",
      [nouveauStatut, dossierTacheId]
    );
    await ajouterMouvement(client, rows[0].dossier_id, utilisateur.id, `Tâche « ${rows[0].libelle} » → ${nouveauStatut}`);
    return rows[0];
  });
}

/**
 * Écriture comptable (provision reçue ou décaissement) sur le compte
 * client du dossier. Append-only : jamais de modification/suppression
 * d'une écriture existante (voir migration).
 */
async function ajouterEcritureCompteClient(dossierId, { sens, categorie, montant, libelle }, utilisateurId) {
  return avecTransaction(async (client) => {
    await client.query(
      `INSERT INTO compte_client_ecritures (dossier_id, sens, categorie, montant, libelle, utilisateur_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [dossierId, sens, categorie, montant, libelle, utilisateurId]
    );
    const verbe = sens === "provision" ? "Provision reçue" : "Décaissement";
    await ajouterMouvement(client, dossierId, utilisateurId, `${verbe} (${categorie}) : ${montant} FCFA`);
  });
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
