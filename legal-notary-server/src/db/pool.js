/**
 * src/db/pool.js — Connexion PostgreSQL partagée.
 *
 * Un seul pool de connexions pour toute l'application, construit à partir
 * de DATABASE_URL (voir .env.example). Aucune dépendance à un fournisseur
 * cloud particulier : n'importe quelle base PostgreSQL standard convient
 * (serveur physique du cabinet, VeOne, ou tout hébergeur cloud).
 *
 * Tous les services (src/services/*.js) passent par `pool.query(...)` ou
 * par un client emprunté via `pool.connect()` quand plusieurs requêtes
 * doivent s'exécuter dans une même transaction (voir `avecTransaction`
 * ci-dessous).
 *
 * Le chargement de `.env` est fait ICI (pas seulement dans src/server.js)
 * pour que tout script qui importe pool.js — migrations, scripts
 * d'import, tests manuels — ait DATABASE_URL sans avoir à penser à
 * appeler `require("dotenv").config()` lui-même. `dotenv.config()` est
 * sans effet si les variables sont déjà chargées, donc appeler ceci
 * plusieurs fois (ex. une fois dans server.js, une fois ici) est sûr.
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Exécute `travail(client)` à l'intérieur d'une transaction SQL : BEGIN,
 * puis COMMIT si `travail` réussit, ROLLBACK s'il lève une exception.
 * À utiliser pour toute opération qui touche plusieurs tables et doit
 * réussir ou échouer en bloc (ex. clôturer un dossier + attribuer une
 * minute + écrire un mouvement).
 */
async function avecTransaction(travail) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultat = await travail(client);
    await client.query("COMMIT");
    return resultat;
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = { pool, avecTransaction };
