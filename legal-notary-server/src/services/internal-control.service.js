/**
 * src/services/internal-control.service.js
 *
 * Service d'administration et de supervision pour le SaaS de Contrôle Centralisé (Master Admin).
 * Gère la télémétrie système, les statistiques SaaS consolidées, la gestion globale des utilisateurs,
 * l'exécution d'actions à distance et la génération de jetons d'impersonation pour le support.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db/pool");
const { notifyControlHub } = require("./webhook-dispatcher.service");

const TOURS_HACHAGE = 12;

/**
 * 1. Healthcheck complet du service et de la base de données.
 */
async function obtenirHealth() {
  const debutPing = Date.now();
  let dbOk = false;
  let dbPingMs = 0;
  let dbError = null;

  try {
    await pool.query("SELECT 1");
    dbOk = true;
    dbPingMs = Date.now() - debutPing;
  } catch (e) {
    dbError = e.message;
  }

  const memoire = process.memoryUsage();

  return {
    status: dbOk ? "healthy" : "degraded",
    service: "legal-notary-server",
    version: "2.4.0-Enterprise",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbOk ? "connected" : "disconnected",
      pingMs: dbPingMs,
      error: dbError,
    },
    system: {
      memoryRssMb: Math.round((memoire.rss / 1024 / 1024) * 10) / 10,
      memoryHeapUsedMb: Math.round((memoire.heapUsed / 1024 / 1024) * 10) / 10,
      nodeVersion: process.version,
      platform: process.platform,
    },
  };
}

/**
 * 2. Statistiques consolidées du SaaS (utilisateurs, MRR, volumétrie).
 */
async function obtenirStats() {
  const [
    totalUsersRes,
    newUsers7dRes,
    newUsers30dRes,
    activeUsersRes,
    etudesRes,
    dossiersRes,
    minutesRes,
  ] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS n FROM utilisateurs"),
    pool.query("SELECT COUNT(*)::int AS n FROM utilisateurs WHERE created_at >= NOW() - INTERVAL '7 days'"),
    pool.query("SELECT COUNT(*)::int AS n FROM utilisateurs WHERE created_at >= NOW() - INTERVAL '30 days'"),
    pool.query("SELECT COUNT(*)::int AS n FROM utilisateurs WHERE actif = true AND archived_at IS NULL"),
    pool.query("SELECT id, code_etude, nom_etude, mode_infrastructure, actif FROM etudes"),
    pool.query("SELECT COUNT(*)::int AS n FROM dossiers"),
    pool.query("SELECT COUNT(*)::int AS n FROM minutes_archive"),
  ]);

  const etudes = etudesRes.rows || [];
  const etudesActives = etudes.filter((e) => e.actif !== false);

  // Estimation du MRR (Tarif moyen de licence par office : ~250 000 FCFA / mois soit ~380 EUR)
  const tarifMoyenEtudeFCFA = 250000;
  const mrrFCFA = etudesActives.length * tarifMoyenEtudeFCFA;
  const mrrEUR = Math.round(mrrFCFA / 655.957);

  return {
    totalUsers: totalUsersRes.rows[0].n,
    newUsers7d: newUsers7dRes.rows[0].n,
    newUsers30d: newUsers30dRes.rows[0].n,
    activeUsers: activeUsersRes.rows[0].n,
    activePaidSubscriptions: etudesActives.length,
    activeStudiesCount: etudesActives.length,
    totalStudiesCount: etudes.length,
    estimatedMRR: {
      currency: "XOF",
      amountFCFA: mrrFCFA,
      amountEUR: mrrEUR,
    },
    businessMetrics: {
      totalDossiers: dossiersRes.rows[0].n,
      totalMinutesArchived: minutesRes.rows[0].n,
      repartitionModes: {
        hybride: etudes.filter((e) => e.mode_infrastructure === "hybride").length,
        cloud: etudes.filter((e) => e.mode_infrastructure === "cloud").length,
        serveur_physique: etudes.filter((e) => e.mode_infrastructure === "local" || e.mode_infrastructure === "serveur_physique").length,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 3. Recherche et listing paginé des utilisateurs pour le Master Admin.
 */
async function rechercherUtilisateurs({ search, limit = 50, page = 1, status } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const p = Math.max(Number(page) || 1, 1);
  const offset = (p - 1) * lim;

  let conditions = ["1=1"];
  const params = [];

  if (search && search.trim()) {
    const s = search.trim();
    params.push(`%${s}%`);
    const idx = params.length;

    // Si c'est un UUID valide, on teste aussi par id exact
    const estUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    if (estUuid) {
      params.push(s);
      conditions.push(`(u.nom_complet ILIKE $${idx} OR u.email ILIKE $${idx} OR u.id = $${params.length})`);
    } else {
      conditions.push(`(u.nom_complet ILIKE $${idx} OR u.email ILIKE $${idx})`);
    }
  }

  if (status === "actif") {
    conditions.push("u.actif = true AND u.archived_at IS NULL");
  } else if (status === "suspendu") {
    conditions.push("(u.actif = false OR u.archived_at IS NOT NULL)");
  }

  const whereSql = conditions.join(" AND ");

  const countQuery = `SELECT COUNT(*)::int AS total FROM utilisateurs u WHERE ${whereSql}`;
  const totalCountRes = await pool.query(countQuery, params);
  const total = totalCountRes.rows[0].total;

  const dataQuery = `
    SELECT u.id, u.nom_complet, u.email, u.role, u.actif, u.archived_at, u.created_at, u.updated_at,
           u.telephone, u.type_contrat,
           e.id AS etude_id, e.nom_etude, e.code_etude, e.mode_infrastructure
    FROM utilisateurs u
    LEFT JOIN etudes e ON e.id = u.etude_id
    WHERE ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, lim, offset];
  const { rows } = await pool.query(dataQuery, queryParams);

  const usersFormatted = rows.map((u) => {
    const estActif = u.actif && !u.archived_at;
    return {
      id: u.id,
      email: u.email,
      name: u.nom_complet,
      role: u.role,
      createdAt: u.created_at,
      plan: u.mode_infrastructure || "Standard",
      status: estActif ? "actif" : "suspendu",
      lastLogin: u.updated_at, // ou dernière connexion enregistrée
      study: {
        id: u.etude_id,
        name: u.nom_etude || "Office Principal",
        code: u.code_etude || "ETUDE-01",
        mode: u.mode_infrastructure || "hybride",
      },
    };
  });

  return {
    users: usersFormatted,
    pagination: {
      total,
      page: p,
      limit: lim,
      totalPages: Math.ceil(total / lim) || 1,
    },
  };
}

/**
 * 4. Exécute une action distante commandée depuis le Master Admin.
 */
async function executerActionUtilisateur(userId, action, payload = {}) {
  const { rows } = await pool.query("SELECT * FROM utilisateurs WHERE id = $1", [userId]);
  if (!rows.length) {
    const err = new Error("Utilisateur introuvable");
    err.status = 404;
    throw err;
  }

  const user = rows[0];
  let resultat = {};

  switch (action) {
    case "suspend":
    case "suspendre": {
      await pool.query(
        "UPDATE utilisateurs SET actif = false, archived_at = NOW(), updated_at = NOW() WHERE id = $1",
        [userId]
      );
      resultat = { succes: true, status: "suspendu", message: `Utilisateur ${user.email} suspendu avec succès.` };
      notifyControlHub("user.status_changed", { userId, email: user.email, action: "suspend" }).catch(() => {});
      break;
    }

    case "activate":
    case "activer": {
      await pool.query(
        "UPDATE utilisateurs SET actif = true, archived_at = NULL, updated_at = NOW() WHERE id = $1",
        [userId]
      );
      resultat = { succes: true, status: "actif", message: `Utilisateur ${user.email} réactivé avec succès.` };
      notifyControlHub("user.status_changed", { userId, email: user.email, action: "activate" }).catch(() => {});
      break;
    }

    case "change_role":
    case "modifier_role": {
      const nouveauRole = payload.role;
      const rolesValides = ["notaire", "premier_clerc", "clerc_redacteur", "clerc_formaliste", "comptable_taxateur", "assistante", "archiviste", "superadmin"];
      if (!nouveauRole || !rolesValides.includes(nouveauRole)) {
        const err = new Error(`Rôle invalide. Rôles acceptés : ${rolesValides.join(", ")}`);
        err.status = 400;
        throw err;
      }
      await pool.query("UPDATE utilisateurs SET role = $1, updated_at = NOW() WHERE id = $2", [nouveauRole, userId]);
      resultat = { succes: true, nouveauRole, message: `Rôle de ${user.email} mis à jour vers '${nouveauRole}'.` };
      break;
    }

    case "reset_password":
    case "reinitialiser_mot_de_passe": {
      // Génère un mot de passe temporaire aléatoire et sécurisé
      const mdpTemporaire = payload.nouveauMotDePasse || `Notaire-${crypto.randomBytes(4).toString("hex").toUpperCase()}!`;
      const hash = await bcrypt.hash(mdpTemporaire, TOURS_HACHAGE);
      await pool.query(
        "UPDATE utilisateurs SET mot_de_passe_hash = $1, updated_at = NOW() WHERE id = $2",
        [hash, userId]
      );
      resultat = {
        succes: true,
        temporaryPassword: mdpTemporaire,
        message: `Mot de passe réinitialisé avec succès pour ${user.email}.`,
      };
      break;
    }

    case "upgrade_plan":
    case "grant_trial":
    case "modifier_plan": {
      if (user.etude_id) {
        const nouveauMode = payload.modeInfrastructure || payload.plan || "cloud";
        await pool.query(
          "UPDATE etudes SET mode_infrastructure = $1, updated_at = NOW() WHERE id = $2",
          [nouveauMode, user.etude_id]
        );
        resultat = { succes: true, plan: nouveauMode, message: `Plan de l'étude mis à niveau vers '${nouveauMode}'.` };
      } else {
        resultat = { succes: true, message: "Aucune étude associée à cet utilisateur." };
      }
      break;
    }

    default: {
      const err = new Error(`Action '${action}' non reconnue.`);
      err.status = 400;
      throw err;
    }
  }

  return resultat;
}

/**
 * 5. Génère un jeton d'impersonation (Magic Link court terme) pour le support Super Admin.
 */
async function genererTokenImpersonation({ userId, email }) {
  let user;

  if (userId) {
    const { rows } = await pool.query("SELECT * FROM utilisateurs WHERE id = $1 AND archived_at IS NULL", [userId]);
    user = rows[0];
  } else if (email) {
    const { rows } = await pool.query("SELECT * FROM utilisateurs WHERE LOWER(email) = LOWER($1) AND archived_at IS NULL", [email.trim()]);
    user = rows[0];
  }

  if (!user) {
    const err = new Error("Utilisateur introuvable ou archivé pour impersonation.");
    err.status = 404;
    throw err;
  }

  // Token ultra-court terme : 60 secondes maximum
  const impersonatePayload = {
    id: user.id,
    role: user.role,
    email: user.email,
    impersonated: true,
    impersonatedBy: "ControlHub-MasterAdmin",
  };

  const token = jwt.sign(impersonatePayload, process.env.JWT_SECRET, {
    expiresIn: "60s",
  });

  return {
    succes: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.nom_complet,
      role: user.role,
    },
    loginUrl: `/?impersonate_token=${token}`,
    expiresInSeconds: 60,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  obtenirHealth,
  obtenirStats,
  rechercherUtilisateurs,
  executerActionUtilisateur,
  genererTokenImpersonation,
};
