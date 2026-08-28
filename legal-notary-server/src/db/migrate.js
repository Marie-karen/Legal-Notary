/**
 * src/db/migrate.js — Exécuteur de migrations SQL, minimal et explicite.
 *
 * Pourquoi un exécuteur maison plutôt qu'un framework de migration : pour
 * qu'un développeur qui reprend ce projet puisse comprendre tout le
 * mécanisme en lisant ce seul fichier, sans dépendance supplémentaire à
 * apprendre. Le fonctionnement est volontairement simple :
 *
 *   1. Chaque fichier de migrations/*.sql est numéroté (001_, 002_, ...).
 *   2. Une table `migrations_appliquees` garde la trace de ce qui a déjà
 *      été exécuté sur CETTE base.
 *   3. Au lancement, on exécute dans l'ordre les fichiers pas encore
 *      appliqués, chacun dans sa propre transaction.
 *
 * Lancement : `npm run migrate` (voir package.json), à faire une fois à
 * l'installation puis à chaque mise à jour du logiciel qui ajoute un
 * fichier de migration.
 */

const fs = require("fs");
const path = require("path");
const { pool } = require("./pool");

const DOSSIER_MIGRATIONS = path.join(__dirname, "..", "..", "migrations");

async function migrer() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations_appliquees (
      nom text PRIMARY KEY,
      applique_le timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await pool.query("SELECT nom FROM migrations_appliquees");
  const dejaAppliquees = new Set(rows.map((r) => r.nom));

  const fichiers = fs
    .readdirSync(DOSSIER_MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const fichier of fichiers) {
    if (dejaAppliquees.has(fichier)) {
      console.log(`[migrate] déjà appliquée : ${fichier}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(DOSSIER_MIGRATIONS, fichier), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migrations_appliquees (nom) VALUES ($1)", [fichier]);
      await client.query("COMMIT");
      console.log(`[migrate] appliquée : ${fichier}`);
    } catch (erreur) {
      await client.query("ROLLBACK");
      console.error(`[migrate] ÉCHEC sur ${fichier} :`, erreur.message);
      throw erreur;
    } finally {
      client.release();
    }
  }

  console.log("[migrate] terminé.");
}

if (require.main === module) {
  migrer()
    .then(() => pool.end())
    .catch((erreur) => {
      console.error(erreur);
      pool.end();
      process.exit(1);
    });
}

module.exports = { migrer };
