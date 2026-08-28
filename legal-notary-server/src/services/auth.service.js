/**
 * src/services/auth.service.js — Authentification des utilisateurs.
 *
 * Mots de passe hachés avec bcrypt (jamais stockés en clair). Une
 * connexion réussie renvoie un jeton JWT signé avec JWT_SECRET (voir
 * .env.example) contenant uniquement { id, role } — jamais de donnée
 * sensible dans le jeton, qui n'est pas chiffré, seulement signé.
 *
 * La création d'utilisateurs (`creerUtilisateur`) n'est PAS exposée en
 * accès public : elle n'est appelée que par la route protégée
 * `equipe:gerer` (notaire, premier clerc — voir src/rbac/roles.js) ou par
 * scripts/creer-premier-utilisateur.js à l'installation initiale.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db/pool");

const TOURS_HACHAGE = 12;

/**
 * `avecSalaire` : le salaire net est une donnée RH sensible (voir
 * migration 002 et permission `equipe:voir_salaires`, notaire uniquement)
 * — jamais renvoyé par défaut. Chaque appelant (route) doit explicitement
 * demander `avecSalaire: true` APRÈS avoir vérifié la permission — voir
 * src/api/equipe.routes.js.
 */
function utilisateurVersCamel(l, { avecSalaire = false } = {}) {
  const base = {
    id: l.id,
    nomComplet: l.nom_complet,
    email: l.email,
    telephone: l.telephone,
    role: l.role,
    etudeId: l.etude_id,
    actif: l.actif,
    dateEmbauche: l.date_embauche,
    typeContrat: l.type_contrat,
  };
  if (avecSalaire) base.salaireNet = l.salaire_net === null ? null : Number(l.salaire_net);
  return base;
}

async function creerUtilisateur({ nomComplet, email, motDePasse, role, telephone, dateEmbauche, typeContrat, salaireNet }, { avecSalaire = false } = {}) {
  const hash = await bcrypt.hash(motDePasse, TOURS_HACHAGE);
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, telephone, date_embauche, type_contrat, salaire_net)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [nomComplet, email.toLowerCase(), hash, role, telephone || "", dateEmbauche || null, typeContrat || null, salaireNet || null]
  );
  return utilisateurVersCamel(rows[0], { avecSalaire });
}

async function modifierUtilisateur(id, champs, { avecSalaire = false } = {}) {
  const { rows: actuels } = await pool.query("SELECT * FROM utilisateurs WHERE id = $1", [id]);
  if (!actuels.length) return null;
  const a = actuels[0];
  const { rows } = await pool.query(
    `UPDATE utilisateurs SET
       nom_complet = $1, telephone = $2, date_embauche = $3, type_contrat = $4, salaire_net = $5, updated_at = now()
     WHERE id = $6 RETURNING *`,
    [
      champs.nomComplet ?? a.nom_complet,
      champs.telephone ?? a.telephone,
      champs.dateEmbauche ?? a.date_embauche,
      champs.typeContrat ?? a.type_contrat,
      champs.salaireNet ?? a.salaire_net,
      id,
    ]
  );
  return utilisateurVersCamel(rows[0], { avecSalaire });
}

async function connecter(email, motDePasse) {
  const { rows } = await pool.query(
    "SELECT * FROM utilisateurs WHERE email = $1 AND actif = true AND archived_at IS NULL",
    [email.toLowerCase()]
  );
  if (!rows.length) return null; // même erreur générique que "mot de passe incorrect" côté route (ne pas révéler si l'email existe)

  const utilisateur = rows[0];
  const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hash);
  if (!motDePasseValide) return null;

  const jeton = jwt.sign(
    { id: utilisateur.id, role: utilisateur.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || "12h" }
  );
  return { jeton, utilisateur: utilisateurVersCamel(utilisateur) };
}

function verifierJeton(jeton) {
  try {
    return jwt.verify(jeton, process.env.JWT_SECRET);
  } catch (erreur) {
    return null;
  }
}

async function listerUtilisateurs({ avecSalaires = false } = {}) {
  const { rows } = await pool.query(
    "SELECT * FROM utilisateurs WHERE archived_at IS NULL ORDER BY nom_complet"
  );
  return rows.map((l) => utilisateurVersCamel(l, { avecSalaire: avecSalaires }));
}

// Suppression logique uniquement (voir règle générale : aucune donnée
// n'est jamais supprimée physiquement).
async function desactiverUtilisateur(id) {
  await pool.query("UPDATE utilisateurs SET actif = false, archived_at = now() WHERE id = $1", [id]);
}

module.exports = {
  creerUtilisateur,
  modifierUtilisateur,
  connecter,
  verifierJeton,
  listerUtilisateurs,
  desactiverUtilisateur,
  utilisateurVersCamel,
};
