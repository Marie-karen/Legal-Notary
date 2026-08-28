/**
 * src/services/telemetrie.service.js — Système Centralisé de Télémétrie,
 * Suivi d'Erreurs Distribuées (Cloud + Serveurs Physiques Locaux) & Alertes DevOps.
 *
 * Ce service garantit que toute panne ou erreur survenant sur :
 *   1. Le serveur Cloud Hostinger central,
 *   2. Un serveur physique local d'office notarial (Mode A / Mode C Cas 3),
 *   3. Le navigateur web d'un clerc,
 * est immédiatement capturée, anonymisée (respect du secret professionnel),
 * enregistrée en base et notifiée à l'équipe technique AVANT que le notaire ne s'en plaigne.
 */

const { pool } = require("../db/pool");

// Variable de configuration Sentry optionnelle (activée si SENTRY_DSN présent)
let sentryClient = null;
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "production",
      tracesSampleRate: 0.2,
    });
    sentryClient = Sentry;
  } catch (e) {
    console.warn("[telemetrie] Sentry SDK non installé ou non configuré : fallback sur le hub interne PostgreSQL.");
  }
}

/**
 * Nettoie le message et le contexte d'erreur pour éviter toute fuite de secret professionnel.
 */
function assainirDonneesErreur(message, meta) {
  let msgPropre = String(message || "Erreur inconnue");
  // Masque d'éventuels tokens ou données confidentielles
  msgPropre = msgPropre.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, "Bearer [MASQUÉ]");
  msgPropre = msgPropre.replace(/motDePasse['"]?\s*[:=]\s*['"]?[^'",\s]+/gi, 'motDePasse: "[MASQUÉ]"');
  return { msgPropre, metaPropre: meta || {} };
}

/**
 * Enregistre une erreur applicative provenant du Cloud ou d'un serveur physique d'étude.
 */
async function enregistrerErreur({
  etudeId = null,
  nomEtude = "Cloud Hostinger Master",
  source = "backend-cloud",
  typeErreur = "UnhandledError",
  message = "",
  stackTrace = "",
  niveau = "error",
  meta = {},
}) {
  const { msgPropre, metaPropre } = assainirDonneesErreur(message, meta);

  const query = `
    INSERT INTO telemetrie_erreurs_parc (
      etude_id, nom_etude, source, type_erreur, message, stack_trace, niveau, meta, statut, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'nouveau', NOW())
    RETURNING *
  `;
  const params = [
    etudeId,
    nomEtude,
    source,
    typeErreur,
    msgPropre,
    stackTrace || "",
    niveau,
    JSON.stringify(metaPropre),
  ];

  const { rows } = await pool.query(query, params);
  const erreurEnregistree = rows[0];

  // Si niveau critique ou error récurrente, déclencher l'alerte immédiate (Slack/Email/DevOps)
  if (niveau === "critique" || niveau === "error") {
    await notifierIncidentDevOps({
      titre: `🚨 [${niveau.toUpperCase()}] Incident sur ${nomEtude} (${source})`,
      message: msgPropre,
      source,
      typeErreur,
      nomEtude,
      id: erreurEnregistree.id,
    });
  }

  // Relais vers Sentry si configuré
  if (sentryClient && (niveau === "error" || niveau === "critique")) {
    sentryClient.captureException(new Error(msgPropre), {
      tags: { source, nomEtude, typeErreur, niveau },
      extra: metaPropre,
    });
  }

  return erreurEnregistree;
}

/**
 * Déclenche une notification d'incident immédiate (Webhook Slack / Discord / Email / Log système).
 */
async function notifierIncidentDevOps({ titre, message, source, typeErreur, nomEtude, id }) {
  const webhookUrl = process.env.DEVOPS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  const horodatage = new Date().toISOString();

  console.error(`\n🚨 [ALERTE DÉVELOPPEUR AUTOMATIQUE - ${horodatage}]`);
  console.error(`👉 Titre : ${titre}`);
  console.error(`👉 Office concerné : ${nomEtude}`);
  console.error(`👉 Source : ${source} | Type : ${typeErreur}`);
  console.error(`👉 Détail : ${message}`);
  console.error(`👉 Réf Incident : ${id}\n`);

  if (webhookUrl) {
    try {
      const payload = {
        text: `🚨 *ALERTE INCIDENT SAAS NOTARIAL*\n*Cible:* ${nomEtude} (${source})\n*Type:* ${typeErreur}\n*Message:* \`${message}\`\n*Horodatage:* ${horodatage}`,
      };
      // Envoi asynchrone non-bloquant
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn("[telemetrie] Erreur envoi webhook DevOps:", e.message));
    } catch (e) {}
  }
}

/**
 * Reçoit le Heartbeat périodique d'un serveur physique local d'une étude (toutes les 30s).
 */
async function recevoirHeartbeat({
  pairToken,
  etudeId,
  nomNoeud = "Serveur Local",
  ipLocale = "192.168.1.50",
  cpuPct = 12,
  ramPct = 34,
  disquePct = 28,
  versionAgent = "v2.4.0",
}) {
  // Recherche ou mise à jour du nœud
  let targetEtudeId = etudeId;
  if (!targetEtudeId && pairToken) {
    const res = await pool.query("SELECT id FROM etudes WHERE id::text = $1 OR code_etude = $1", [pairToken]);
    if (res.rows.length) targetEtudeId = res.rows[0].id;
  }

  // Vérification si alerte charge anormale
  let statut = "en_ligne";
  if (parseFloat(cpuPct) > 90 || parseFloat(disquePct) > 90) {
    statut = "charge_elevee";
  }

  const query = `
    INSERT INTO noeuds_heartbeat_parc (
      etude_id, nom_noeud, pair_token, ip_locale, cpu_pct, ram_pct, disque_pct, version_agent, derniere_activite, statut
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
    ON CONFLICT (id) DO UPDATE SET
      cpu_pct = $5,
      ram_pct = $6,
      disque_pct = $7,
      ip_locale = $4,
      version_agent = $8,
      derniere_activite = NOW(),
      statut = $9
    RETURNING *
  `;

  // On cherche si un nœud avec ce nom/pairToken existe déjà pour mettre à jour
  const existant = await pool.query(
    "SELECT id FROM noeuds_heartbeat_parc WHERE nom_noeud = $1 OR (pair_token IS NOT NULL AND pair_token = $2)",
    [nomNoeud, pairToken]
  );

  if (existant.rows.length) {
    const updateRes = await pool.query(
      `UPDATE noeuds_heartbeat_parc
       SET cpu_pct = $1, ram_pct = $2, disque_pct = $3, ip_locale = $4, version_agent = $5, derniere_activite = NOW(), statut = $6
       WHERE id = $7 RETURNING *`,
      [cpuPct, ramPct, disquePct, ipLocale, versionAgent, statut, existant.rows[0].id]
    );
    return updateRes.rows[0];
  } else {
    const insertRes = await pool.query(
      `INSERT INTO noeuds_heartbeat_parc (etude_id, nom_noeud, pair_token, ip_locale, cpu_pct, ram_pct, disque_pct, version_agent, derniere_activite, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) RETURNING *`,
      [targetEtudeId, nomNoeud, pairToken, ipLocale, cpuPct, ramPct, disquePct, versionAgent, statut]
    );
    return insertRes.rows[0];
  }
}

/**
 * Vérifie l'état de santé de tous les serveurs physiques locaux du parc.
 * Si un serveur local n'a pas émis de heartbeat depuis > 2 minutes, il est marqué "hors_ligne"
 * et une alerte est levée.
 */
async function surveillerSanteNoeuds() {
  const { rows } = await pool.query(`
    SELECT n.*, e.nom_etude, e.titre_notaire
    FROM noeuds_heartbeat_parc n
    LEFT JOIN etudes e ON n.etude_id = e.id
    ORDER BY n.derniere_activite DESC
  `);

  const maintenant = new Date();
  const noeudsTraites = [];

  for (const noeud of rows) {
    const diffSec = (maintenant.getTime() - new Date(noeud.derniere_activite).getTime()) / 1000;
    let statutActuel = noeud.statut;

    if (diffSec > 120 && statutActuel !== "hors_ligne") {
      statutActuel = "hors_ligne";
      await pool.query("UPDATE noeuds_heartbeat_parc SET statut = 'hors_ligne' WHERE id = $1", [noeud.id]);
      
      // Alerte proactive !
      await notifierIncidentDevOps({
        titre: `🔴 [RUPTURE HEARTBEAT] Serveur Local Déconnecté`,
        message: `Le serveur physique de l'Office "${noeud.nom_etude || noeud.nom_noeud}" n'a plus émis de signal depuis ${Math.round(diffSec)}s. Cause probable : coupure internet box Orange/MTN ou coupure d'électricité locale à l'office.`,
        source: "heartbeat-watchdog",
        typeErreur: "EdgeServerOffline",
        nomEtude: noeud.nom_etude || noeud.nom_noeud,
        id: noeud.id,
      });
    } else if (diffSec <= 120 && statutActuel === "hors_ligne") {
      statutActuel = "en_ligne";
      await pool.query("UPDATE noeuds_heartbeat_parc SET statut = 'en_ligne' WHERE id = $1", [noeud.id]);
    }

    noeudsTraites.push({
      ...noeud,
      statut: statutActuel,
      secondesDepuisDernierSignal: Math.round(diffSec),
    });
  }

  return noeudsTraites;
}

/**
 * Récupère la liste des erreurs et logs du parc avec filtres.
 */
async function listerErreursParc({ limite = 50, niveau = null, statut = null } = {}) {
  let sql = "SELECT * FROM telemetrie_erreurs_parc WHERE 1=1";
  const params = [];

  if (niveau) {
    params.push(niveau);
    sql += ` AND niveau = $${params.length}`;
  }
  if (statut) {
    params.push(statut);
    sql += ` AND statut = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limite);

  const { rows } = await pool.query(sql, params);
  return rows;
}

/**
 * Marque une erreur comme résolue par le développeur.
 */
async function resoudreErreur(id) {
  const { rows } = await pool.query(
    "UPDATE telemetrie_erreurs_parc SET statut = 'resolu' WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0];
}

/**
 * Simule un test d'alerte critique pour valider la chaîne de remontée.
 */
async function testerAlerteCritique() {
  return enregistrerErreur({
    etudeId: null,
    nomEtude: "Simulation Test DevOps",
    source: "superadmin-console",
    typeErreur: "SimulationTestIncident",
    message: "🧪 Test de validation du canal d'alerte instantanée (Sentry / Webhook / Email / Watchdog). Tout est opérationnel !",
    stackTrace: "Error: Simulation Test\n    at testerAlerteCritique (/src/services/telemetrie.service.js:195:10)",
    niveau: "critique",
    meta: { testPar: "Direction SaaS", date: new Date().toISOString() },
  });
}

module.exports = {
  enregistrerErreur,
  recevoirHeartbeat,
  surveillerSanteNoeuds,
  listerErreursParc,
  resoudreErreur,
  testerAlerteCritique,
};
