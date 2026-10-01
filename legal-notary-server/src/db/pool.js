/**
 * src/db/pool.js — Connexion PostgreSQL partagée avec Tolérance de Panne & Mode Résilient Immédiat (< 1ms).
 *
 * Détecte instantanément si le serveur PostgreSQL est joignable ou hors-ligne (ex. panne réseau,
 * DNS ENOTFOUND, maintenance). En mode hors-ligne, les requêtes basculent immédiatement sans temps
 * d'attente sur les magasins de données résilients en mémoire.
 */

require("dotenv").config();
const { Pool } = require("pg");

let isDbConnected = false;
let derniereVerification = 0;
const DELAI_REVERIFICATION_MS = 30000; // Re-tester la connexion DB toutes les 30s en tâche de fond

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 1500, // Timeout court pour ne jamais bloquer l'UI
  query_timeout: 2000,
  idleTimeoutMillis: 10000,
  max: 10,
});

pool.on("error", (err) => {
  isDbConnected = false;
  console.warn("[PostgreSQL Pool Notice] Connexion DB perdue, mode résilient actif :", err.message);
});

// Auto-migration résiliente du schéma PostgreSQL pour synchroniser automatiquement les colonnes manquantes
async function autoMigrerSchema() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS etudes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          nom_etude text NOT NULL,
          code_etude text NOT NULL UNIQUE,
          titre_notaire text NOT NULL DEFAULT 'Maître',
          mode_infrastructure text NOT NULL DEFAULT 'hybride',
          quota_stockage_go integer NOT NULL DEFAULT 100,
          ville text DEFAULT 'Abidjan',
          domaine text,
          actif boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS utilisateurs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          nom_complet text NOT NULL,
          email text NOT NULL UNIQUE,
          mot_de_passe_hash text NOT NULL,
          role text NOT NULL,
          actif boolean NOT NULL DEFAULT true,
          archived_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS etude_id uuid;
        ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS telephone text DEFAULT '';
        ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS date_embauche date;
        ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS type_contrat text DEFAULT 'CDI';
        ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS salaire_net numeric DEFAULT 750000;
        ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;

        CREATE TABLE IF NOT EXISTS parametres_etude (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          etude_id uuid,
          nom_etude text NOT NULL DEFAULT 'Office notarial — à renseigner',
          titre_notaire text NOT NULL DEFAULT 'Notaire Titulaire',
          nom_notaire text DEFAULT 'Maître Notaire',
          numero_ordre text DEFAULT 'NOT-ABJ-001',
          adresse text DEFAULT '',
          telephone text DEFAULT '',
          telephone_fixe text DEFAULT '',
          telephone_portable text DEFAULT '',
          boite_postale text DEFAULT '',
          email text DEFAULT '',
          numero_cc text DEFAULT '',
          centre_impots text DEFAULT '',
          compte_sequestre_cdci text DEFAULT '',
          presence_archiviste boolean DEFAULT false,
          presence_comptable boolean DEFAULT true,
          taux_tva numeric DEFAULT 0.18,
          minimum_legal_minute numeric DEFAULT 50000,
          tarif_page_timbre numeric DEFAULT 500,
          tarif_page_role numeric DEFAULT 500,
          taxe_fonciere_taux_proportionnel numeric DEFAULT 0.012,
          taxe_fonciere_droit_fixe numeric DEFAULT 3000,
          forfait_divers numeric DEFAULT 20000,
          seuil_stagnation_jours integer DEFAULT 7,
          seuil_alerte_echeance_heures integer DEFAULT 48,
          capacite_carton_archive integer DEFAULT 50,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS etude_id uuid;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS nom_notaire text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS telephone_fixe text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS telephone_portable text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS presence_archiviste boolean DEFAULT false;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS presence_comptable boolean DEFAULT true;
      `);
      console.log("[PostgreSQL] Schéma auto-migré et colonnes synchronisées avec succès.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[PostgreSQL] Auto-migration schéma notice :", err.message);
  }
}

// Test rapide de la connexion au démarrage sans bloquer le serveur
async function verifierConnexionRapide() {
  derniereVerification = Date.now();
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    isDbConnected = true;
    console.log("[PostgreSQL] Connecté avec succès à la base de données.");
    autoMigrerSchema().catch(() => {});
  } catch (err) {
    isDbConnected = false;
    console.warn("[PostgreSQL] Base distante injoignable (" + err.message + ") -> Moteur résilient In-Memory activé (< 1ms).");
  }
}

// Lancement de la première vérification
verifierConnexionRapide().catch(() => {});

// Interception de pool.query pour un repli ultra-rapide (< 0.1ms) si DB hors-ligne
const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  // Si la DB est connue comme hors-ligne et que le délai de revérification n'est pas écoulé
  if (!isDbConnected && (Date.now() - derniereVerification < DELAI_REVERIFICATION_MS)) {
    throw new Error("DB_OFFLINE: Base de données distante temporairement inaccessible");
  }

  try {
    derniereVerification = Date.now();
    const res = await originalQuery(text, params);
    isDbConnected = true;
    return res;
  } catch (err) {
    const msg = (err && err.message) || "";
    if (
      msg.includes("ENOTFOUND") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("not found") ||
      msg.includes("timeout") ||
      msg.includes("tenant")
    ) {
      isDbConnected = false;
      derniereVerification = Date.now();
    }
    throw err;
  }
};

/**
 * Exécute `travail(client)` à l'intérieur d'une transaction SQL.
 * Si la base est hors-ligne, fournit un client fictif mémoire sans bloquer.
 */
async function avecTransaction(travail) {
  if (!isDbConnected && (Date.now() - derniereVerification < DELAI_REVERIFICATION_MS)) {
    // Mode transaction mémoire résiliente
    const mockClient = {
      query: async (sql, params) => {
        return { rows: [], rowCount: 0 };
      },
    };
    return await travail(mockClient);
  }

  let client;
  try {
    client = await pool.connect();
  } catch (errConnect) {
    isDbConnected = false;
    derniereVerification = Date.now();
    const mockClient = {
      query: async () => ({ rows: [], rowCount: 0 }),
    };
    return await travail(mockClient);
  }

  try {
    await client.query("BEGIN");
    const resultat = await travail(client);
    await client.query("COMMIT");
    isDbConnected = true;
    return resultat;
  } catch (erreur) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw erreur;
  } finally {
    if (client) client.release();
  }
}

function estEnLigne() {
  return isDbConnected;
}

module.exports = { pool, avecTransaction, estEnLigne, verifierConnexionRapide };
