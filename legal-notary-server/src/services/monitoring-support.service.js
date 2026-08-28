/**
 * src/services/monitoring-support.service.js — Monitoring d'instance & Support L1-L4 audité.
 *
 * Gère la télémétrie de santé de l'étude (App, DB, Storage, Sync, Backup) et le workflow
 * de tickets support avec demande d'accès temporaire conditionnée et strictement auditée.
 */

const { pool } = require("../db/pool");

async function obtenirMonitoringInstance(etudeId = "a0000000-0000-0000-0000-000000000001") {
  const { rows: instances } = await pool.query(
    "SELECT * FROM instances_monitoring WHERE etude_id = $1",
    [etudeId]
  );
  const { rows: statsDossiers } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN statut = 'cloture' THEN 1 END)::int AS clotures,
      COUNT(CASE WHEN statut_numerisation = 'NUMERISE_ET_VALIDE' THEN 1 END)::int AS numerises,
      COUNT(CASE WHEN statut_numerisation = 'NUMERISATION_PARTIELLE' THEN 1 END)::int AS partiels,
      COUNT(CASE WHEN statut_numerisation = 'NON_NUMERISE' THEN 1 END)::int AS non_numerises
    FROM dossiers WHERE etude_id = $1
  `, [etudeId]);

  const { rows: statsCartons } = await pool.query(
    "SELECT COUNT(*)::int AS total_cartons, COALESCE(SUM(nombre_dossiers), 0)::int AS total_dossiers_carton FROM cartons_archive WHERE etude_id = $1",
    [etudeId]
  );

  const { rows: statsSorties } = await pool.query(
    "SELECT COUNT(*)::int AS sortis FROM mouvements_dossiers_physiques WHERE etude_id = $1 AND statut = 'en_cours'",
    [etudeId]
  );

  const inst = instances.length ? instances[0] : {
    mode_infrastructure: "hybride",
    statut_app: "operationnel",
    statut_db: "operationnel",
    statut_stockage: "operationnel",
    statut_sync: "operationnel",
    statut_backup: "operationnel",
    espace_stockage_utilise_mo: 1450,
    espace_stockage_total_mo: 50000,
    elements_en_attente_sync: 0,
    derniere_synchro: new Date(),
    dernier_backup: new Date(),
    version_app: "2.4.0",
    ip_locale: "192.168.1.100",
  };

  const sd = statsDossiers[0] || {};
  const sc = statsCartons[0] || {};
  const ss = statsSorties[0] || {};

  return {
    sante: {
      modeInfrastructure: inst.mode_infrastructure,
      application: inst.statut_app,
      baseDeDonnees: inst.statut_db,
      stockage: inst.statut_stockage,
      synchronisation: inst.statut_sync,
      sauvegarde: inst.statut_backup,
      espaceUtiliseMo: inst.espace_stockage_utilise_mo,
      espaceTotalMo: inst.espace_stockage_total_mo,
      derniereSynchro: inst.derniere_synchro,
      dernierBackup: inst.dernier_backup,
      versionApp: inst.version_app,
      ipLocale: inst.ip_locale,
    },
    indicateursMetier: {
      totalDossiers: sd.total || 0,
      dossiersClotures: sd.clotures || 0,
      dossiersNumerises: sd.numerises || 0,
      dossiersPartiellementNumerises: sd.partiels || 0,
      dossiersNonNumerises: sd.non_numerises || 0,
      cartonsPhysiques: sc.total_cartons || 0,
      dossiersEnCartons: sc.total_dossiers_carton || 0,
      dossiersActuellementSortis: ss.sortis || 0,
    },
  };
}

async function creerTicketSupport({
  etudeId = "a0000000-0000-0000-0000-000000000001",
  utilisateurId,
  titre,
  description,
  niveau = "L1",
  priorite = "normale",
}) {
  const monitoring = await obtenirMonitoringInstance(etudeId);
  const numeroTicket = `TICK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const { rows } = await pool.query(
    `INSERT INTO tickets_support
     (etude_id, numero_ticket, utilisateur_id, titre, description, niveau, statut, priorite, diagnostic_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, 'ouvert', $7, $8)
     RETURNING *`,
    [
      etudeId,
      numeroTicket,
      utilisateurId,
      titre,
      description,
      niveau,
      priorite,
      JSON.stringify(monitoring.sante),
    ]
  );
  return rows[0];
}

async function listerTickets(etudeId = "a0000000-0000-0000-0000-000000000001") {
  const { rows } = await pool.query(
    `SELECT t.*, u.nom_complet AS demandeur_nom
     FROM tickets_support t
     LEFT JOIN utilisateurs u ON u.id = t.utilisateur_id
     WHERE t.etude_id = $1
     ORDER BY t.created_at DESC`,
    [etudeId]
  );
  return rows;
}

async function accorderAccesTemporaireSupport({
  ticketId,
  motif,
  dureeMinutes = 60,
  intervenantSupport,
  utilisateurId,
}) {
  const expiration = new Date(Date.now() + dureeMinutes * 60 * 1000);
  const { rows } = await pool.query(
    `UPDATE tickets_support
     SET acces_donnees_accorde = true,
         motif_acces = $1,
         expiration_acces = $2,
         intervenant_support = $3,
         updated_at = now()
     WHERE id = $4
     RETURNING *`,
    [motif || "Diagnostic incident technique", expiration, intervenantSupport || "Équipe DevOps SaaS", ticketId]
  );

  // Journaliser dans l'audit légal
  await pool.query(
    `INSERT INTO journal_audit (table_cible, ligne_id, action, utilisateur_id, details)
     VALUES ('tickets_support', $1, 'ACCES_TEMPORAIRE_SUPPORT_ACCORDE', $2, $3)`,
    [ticketId, utilisateurId, JSON.stringify({ motif, expiration, intervenantSupport })]
  );

  return rows[0];
}

module.exports = {
  obtenirMonitoringInstance,
  creerTicketSupport,
  listerTickets,
  accorderAccesTemporaireSupport,
};
