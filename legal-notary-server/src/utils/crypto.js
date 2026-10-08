/**
 * src/utils/crypto.js — Chiffrement au repos des identifiants sensibles.
 *
 * POURQUOI : Les identifiants tiers (mot de passe SMTP, tokens SMS/WhatsApp,
 * clé privée Web Push) sont stockés dans la base PostgreSQL du cabinet.
 * Pour prévenir toute fuite en cas de dump de base non sécurisé ou d'accès
 * direct au stockage, ces données sont chiffrées au repos via AES-256-GCM
 * avec un vecteur d'initialisation (IV) unique et une étiquette d'authentification.
 *
 * Rétrocompatibilité : Si une donnée présente en base n'a pas le préfixe
 * `enc:v1:`, elle est renvoyée telle quelle (migration douce sans interruption).
 */

const crypto = require("crypto");

const ALGORITHME = "aes-256-gcm";
const PREFIXE = "enc:v1:";

function obtenirCle() {
  const secret = process.env.CLE_CHIFFREMENT_NOTIFS || process.env.JWT_SECRET || "cle-secours-legal-notary-2026-ci-32b";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

/**
 * Chiffre une chaîne de texte en AES-256-GCM.
 * Format de sortie : `enc:v1:<iv_hex>:<tag_hex>:<donnees_hex>`
 */
function chiffrer(texte) {
  if (texte === null || texte === undefined || texte === "") return texte;
  if (typeof texte !== "string") texte = String(texte);
  if (texte.startsWith(PREFIXE)) return texte; // Déjà chiffré

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHME, obtenirCle(), iv);
  let chiffre = cipher.update(texte, "utf8", "hex");
  chiffre += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return `${PREFIXE}${iv.toString("hex")}:${tag}:${chiffre}`;
}

/**
 * Déchiffre une chaîne de texte si elle est au format `enc:v1:...`.
 * Si la chaîne est en clair (donnée antérieure), la renvoie telle quelle.
 */
function dechiffrer(chaine) {
  if (!chaine || typeof chaine !== "string") return chaine;
  if (!chaine.startsWith(PREFIXE)) return chaine; // Donnée non chiffrée (legacy)

  try {
    const sansPrefixe = chaine.slice(PREFIXE.length);
    const parties = sansPrefixe.split(":");
    if (parties.length !== 3) return chaine;

    const [ivHex, tagHex, donneeHex] = parties;
    const decipher = crypto.createDecipheriv(ALGORITHME, obtenirCle(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    let clair = decipher.update(donneeHex, "hex", "utf8");
    clair += decipher.final("utf8");
    return clair;
  } catch (erreur) {
    console.error("[crypto] Échec du déchiffrement :", erreur.message);
    return "";
  }
}

/**
 * Chiffre un objet JSON pour le stocker dans une colonne PostgreSQL jsonb.
 * Format stocké : `{ "_chiffre": "enc:v1:..." }`
 */
function chiffrerObjet(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (obj._chiffre) return obj; // Déjà chiffré
  if (Object.keys(obj).length === 0) return {}; // Objet vide

  const jsonStr = JSON.stringify(obj);
  return { _chiffre: chiffrer(jsonStr) };
}

/**
 * Déchiffre un objet JSON encapsulé sous `{ "_chiffre": "enc:v1:..." }`.
 * Si l'objet est un json standard sans champ `_chiffre`, le renvoie tel quel.
 */
function dechiffrerObjet(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (!obj._chiffre) return obj;

  try {
    const clairStr = dechiffrer(obj._chiffre);
    if (!clairStr) return {};
    return JSON.parse(clairStr);
  } catch (erreur) {
    console.error("[crypto] Échec du déchiffrement d'objet :", erreur.message);
    return {};
  }
}

module.exports = {
  chiffrer,
  dechiffrer,
  chiffrerObjet,
  dechiffrerObjet,
};
