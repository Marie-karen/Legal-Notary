/**
 * scripts/creer-premier-utilisateur.js — Bootstrap du tout premier compte.
 *
 * Pourquoi un script séparé plutôt que la route POST /api/equipe : cette
 * route exige déjà d'être connecté avec la permission `equipe:gerer` — un
 * système fermé, volontairement, pour qu'aucun compte ne puisse se créer
 * lui-même depuis l'extérieur. Il faut donc un premier compte "notaire"
 * créé directement en base, une seule fois, à l'installation.
 *
 * Usage :
 *   node scripts/creer-premier-utilisateur.js "Nom complet" email@etude.ci motdepasse
 *
 * Ne crée rien si un utilisateur avec cet email existe déjà (sûr à
 * relancer par erreur).
 */

require("dotenv").config();
const { pool } = require("../src/db/pool");
const authService = require("../src/services/auth.service");

async function main() {
  const [nomComplet, email, motDePasse] = process.argv.slice(2);
  if (!nomComplet || !email || !motDePasse) {
    console.error('Usage : node scripts/creer-premier-utilisateur.js "Nom complet" email@etude.ci motdepasse');
    process.exit(1);
  }
  if (motDePasse.length < 8) {
    console.error("Le mot de passe doit contenir au moins 8 caractères.");
    process.exit(1);
  }

  const { rows } = await pool.query("SELECT id FROM utilisateurs WHERE email = $1", [email.toLowerCase()]);
  if (rows.length) {
    console.log(`[bootstrap] un utilisateur existe déjà pour ${email} — rien à faire.`);
    return;
  }

  const utilisateur = await authService.creerUtilisateur({ nomComplet, email, motDePasse, role: "notaire" });
  console.log(`[bootstrap] compte créé : ${utilisateur.email} (rôle : ${utilisateur.role}).`);
}

main()
  .then(() => pool.end())
  .catch((erreur) => {
    console.error(erreur);
    pool.end();
    process.exit(1);
  });
