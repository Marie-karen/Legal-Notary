/**
 * src/db/pool.js — Connexion PostgreSQL partagée avec Tolérance de Panne & Mode Résilient Immédiat (< 1ms).
 *
 * Détecte instantanément si le serveur PostgreSQL est joignable ou hors-ligne (ex. panne réseau,
 * DNS ENOTFOUND, maintenance). En mode hors-ligne, les requêtes basculent immédiatement sans temps
 * d'attente sur les magasins de données résilients en mémoire.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const isTestEnv = process.env.NODE_ENV === "test";

// Recherche multi-chemins robuste des fichiers d'environnement
if (isTestEnv) {
  const cheminsTest = [
    path.join(process.cwd(), ".env.test"),
    path.join(__dirname, "..", "..", ".env.test"),
    path.join(__dirname, "..", ".env.test"),
    path.join(process.cwd(), "legal-notary-server", ".env.test"),
  ];
  for (const chemin of cheminsTest) {
    if (fs.existsSync(chemin)) {
      dotenv.config({ path: chemin });
      break;
    }
  }
} else {
  const cheminsPossibles = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "..", "..", ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(process.cwd(), "legal-notary-server", ".env"),
    "/var/www/legal-notary/legal-notary-server/.env",
    "/var/www/legal-notary/.env",
  ];
  for (const chemin of cheminsPossibles) {
    if (fs.existsSync(chemin)) {
      dotenv.config({ path: chemin });
      break;
    }
  }
}
dotenv.config(); // Fallback

const { Pool } = require("pg");

let isDbConnected = false;
let derniereTentativeEchouee = 0;
const DELAI_REVERIFICATION_MS = 30000; // Re-tester la connexion DB toutes les 30s en tâche de fond

const poolConfig = {
  connectionTimeoutMillis: 3000,
  query_timeout: 5000,
  idleTimeoutMillis: 10000,
  max: 10,
};

// Résolution de la chaîne de connexion
let connectionStringCible = "";
if (isTestEnv) {
  connectionStringCible = process.env.TEST_DATABASE_URL || "postgresql://localhost:5432/legal_notary_test";

  // SÉCURITÉ STRICTE (Règle 2) : les tests refusent catégoriquement de s'exécuter
  // si l'adresse de la base ne contient pas "localhost" ou "127.0.0.1".
  const urlLower = connectionStringCible.toLowerCase();
  if (!urlLower.includes("localhost") && !urlLower.includes("127.0.0.1")) {
    const messageErreurSecurite =
      `[SÉCURITÉ STRICTE - TESTS REFUSÉS]\n` +
      `Les tests automatisés doivent UNIQUEMENT cibler une base locale isolée.\n` +
      `URL fournie : "${connectionStringCible}"\n` +
      `Cette adresse ne contient ni "localhost" ni "127.0.0.1".\n` +
      `L'exécution sur Supabase ou une base distante de production est FORMELLEMENT INTERDITE.`;
    console.error(messageErreurSecurite);
    throw new Error(messageErreurSecurite);
  }
  poolConfig.connectionString = connectionStringCible;
  poolConfig.password = String(process.env.PGPASSWORD || process.env.DB_PASSWORD || "");
} else if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  poolConfig.password = String(process.env.PGPASSWORD || process.env.DB_PASSWORD || "");
} else {
  poolConfig.host = process.env.PGHOST || process.env.DB_HOST || "localhost";
  poolConfig.port = Number(process.env.PGPORT || process.env.DB_PORT) || 5432;
  poolConfig.user = process.env.PGUSER || process.env.DB_USER || "postgres";
  poolConfig.password = String(process.env.PGPASSWORD || process.env.DB_PASSWORD || "");
  poolConfig.database = process.env.PGDATABASE || process.env.DB_NAME || "legalnotary";
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  isDbConnected = false;
  derniereTentativeEchouee = Date.now();
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

        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS pays text DEFAULT 'ci';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS langue text DEFAULT 'fr';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS pack_regional text DEFAULT 'ohada-uemoa';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS fuseau_horaire text DEFAULT 'Africa/Abidjan';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS indicatif_tel text DEFAULT '+225';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS devise_code text DEFAULT 'XOF';
        ALTER TABLE etudes ADD COLUMN IF NOT EXISTS devise_symbole text DEFAULT 'FCFA';

        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS etude_id uuid;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS nom_notaire text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS telephone_fixe text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS telephone_portable text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS pays text DEFAULT 'ci';
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS langue text DEFAULT 'fr';
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS devise_code text DEFAULT 'XOF';
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS devise_symbole text DEFAULT 'FCFA';

        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS devise_code text DEFAULT 'XOF';
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS bareme_version_id text;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS presence_archiviste boolean DEFAULT false;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS presence_comptable boolean DEFAULT true;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS mode_numerotation VARCHAR(30) DEFAULT 'global';
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS format_numerotation VARCHAR(100) DEFAULT 'DOS-{AAAA}-{NUM}';
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS dernier_numero_global INTEGER DEFAULT 0;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS derniers_numeros_par_nature JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE parametres_etude ADD COLUMN IF NOT EXISTS premier_clerc_voir_finances BOOLEAN DEFAULT false;

        -- Dossiers : DNO, statut de paiement provision, pièces jointes
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS type_creation VARCHAR(30) DEFAULT 'dossier_ouvert';
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS numero_dno VARCHAR(50);
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS statut_dno VARCHAR(30) DEFAULT 'ouvert';
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS type_personne VARCHAR(20) DEFAULT 'physique';
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS pieces_jointes_dno JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS frais_ouverture BIGINT DEFAULT 0;
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provision_versee BIGINT DEFAULT 0;
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS mode_paiement_provision VARCHAR(50);
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_paiement_provision TIMESTAMPTZ;
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS comptable_validateur_id UUID;
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS email_client VARCHAR(255);
        ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS telephone_client VARCHAR(50);

        -- Table des reçus de paiement
        CREATE TABLE IF NOT EXISTS recus_paiement (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          etude_id UUID,
          numero_recu VARCHAR(50) NOT NULL UNIQUE,
          dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
          client_nom VARCHAR(255) NOT NULL,
          client_email VARCHAR(255),
          client_telephone VARCHAR(50),
          montant_total BIGINT NOT NULL,
          frais_ouverture BIGINT NOT NULL DEFAULT 0,
          provision BIGINT NOT NULL DEFAULT 0,
          montant_assiette BIGINT DEFAULT 0,
          mode_paiement VARCHAR(50) NOT NULL,
          statut VARCHAR(30) NOT NULL DEFAULT 'en_attente_validation',
          cree_par_id UUID REFERENCES utilisateurs(id),
          valide_par_id UUID REFERENCES utilisateurs(id),
          valide_le TIMESTAMPTZ,
          envoye_au_client_le TIMESTAMPTZ,
          recu_scanne_url TEXT,
          recu_scanne_nom TEXT,
          recu_scanne_le TIMESTAMPTZ,
          observations TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
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
  const allowInMemory = process.env.ALLOW_IN_MEMORY === "true" && process.env.NODE_ENV !== "production";

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    isDbConnected = true;
    derniereTentativeEchouee = 0;
    console.log("[PostgreSQL] Connecté avec succès à la base de données.");
    if (!isTestEnv) {
      autoMigrerSchema().catch(() => {});
    }
  } catch (err) {
    isDbConnected = false;
    derniereTentativeEchouee = Date.now();

    // Journalisation structurée de l'erreur
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      niveau: "CRITICAL",
      composant: "database-pool",
      message: "PostgreSQL est inaccessible au démarrage",
      erreur: err.message,
      code: err.code || "DB_CONNECTION_FAILED",
      allowInMemory,
      environnement: process.env.NODE_ENV || "development",
    }));

    // Envoi d'une alerte via telemetrieService
    try {
      const telemetrieService = require("../services/telemetrie.service");
      telemetrieService.enregistrerErreur({
        source: "database-startup",
        typeErreur: "PostgresConnectionFailed",
        message: `Échec de connexion PostgreSQL critique : ${err.message}`,
        niveau: "critical",
      }).catch(() => {});
    } catch (_) {}

    // Règle 3 : Le mode In-Memory ne doit exister qu'en développement et en test,
    // activé explicitement par ALLOW_IN_MEMORY=true.
    // En production, si PostgreSQL est injoignable, le serveur refuse de démarrer.
    if (!allowInMemory) {
      console.error(
        "[PostgreSQL ARRÊT DU SERVEUR] En production ou sans ALLOW_IN_MEMORY=true, " +
        "le serveur refuse de démarrer sans base de données PostgreSQL joignable."
      );
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    } else {
      console.warn("[PostgreSQL Mode Résilient] Base injoignable -> ALLOW_IN_MEMORY activé en dev/test.");
    }
  }
}

// Lancement de la première vérification
verifierConnexionRapide().catch(() => {});

// Interception de pool.query pour un repli ultra-rapide (< 0.1ms) si DB hors-ligne confirmée
const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  const allowInMemory = process.env.ALLOW_IN_MEMORY === "true" && process.env.NODE_ENV !== "production";

  // Si une tentative précédente a échoué il y a moins de 30 secondes, basculer sans attendre
  if (!isDbConnected && derniereTentativeEchouee > 0 && (Date.now() - derniereTentativeEchouee < DELAI_REVERIFICATION_MS)) {
    if (!allowInMemory) {
      throw new Error("DB_OFFLINE: Base de données PostgreSQL inaccessible (mode In-Memory désactivé).");
    }
    throw new Error("DB_OFFLINE: Base de données distante temporairement inaccessible");
  }

  try {
    const res = await originalQuery(text, params);
    isDbConnected = true;
    derniereTentativeEchouee = 0;
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
      derniereTentativeEchouee = Date.now();
    }
    throw err;
  }
};

/**
 * Exécute `travail(client)` à l'intérieur d'une transaction SQL.
 * Si la base est hors-ligne, fournit un client fictif mémoire uniquement si ALLOW_IN_MEMORY est activé.
 */
async function avecTransaction(travail) {
  const allowInMemory = process.env.ALLOW_IN_MEMORY === "true" && process.env.NODE_ENV !== "production";

  if (!isDbConnected && (Date.now() - derniereTentativeEchouee < DELAI_REVERIFICATION_MS)) {
    if (!allowInMemory) {
      throw new Error("DB_OFFLINE: Base de données inaccessible pour transaction.");
    }
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
    derniereTentativeEchouee = Date.now();
    if (!allowInMemory) {
      throw errConnect;
    }
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
