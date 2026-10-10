/**
 * src/config/index.js — Module de configuration centralisé et validation des clés secrètes (Correctif S04).
 *
 * Exigences de sécurité strictes (Section 3 bis & S04) :
 * 1. Clés obligatoires : JWT_SECRET, BACKUP_ENCRYPTION_KEY, CLE_CHIFFREMENT_NOTIFS, CONTROL_HUB_SECRET_KEY.
 * 2. Format obligatoire : exactement 64 caractères hexadécimaux (32 octets aléatoires).
 * 3. Indépendance absolue : aucune retombée ni réutilisation entre clés.
 * 4. Révocation stricte : rejet immédiat des anciennes clés bannies via leur empreinte SHA-256.
 * 5. Confidentialité totale : les valeurs des clés ne sont JAMAIS affichées dans les logs ni les erreurs.
 * 6. Arrêt immédiat (fail-secure) au démarrage si une condition n'est pas remplie.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

// Empreintes SHA-256 des anciennes clés de secours et replis révoqués (ne stocke AUCUN secret en clair)
const EMPREINTES_CLES_BANNIES = new Set([
  "3949ec750a26ce72590f081752435afa1e4c7f475f59baece967114e2b48ad7c", // Ancien repli JWT hex
  "71f27e33bb6d1f43c3c5fe330764f55a2c1558566bc2a0430836e79a92c1b6c4", // Ancien repli sauvegarde
  "3cd1400707cd83dbe042c05a2c7509d9135384a4983b05700a6da46904843275", // Ancien repli notifications
  "b8982566c8407172af3eb15ae81378ae44a21dc24e2b87fe00bd3d717187818c", // Ancien repli control hub
]);

const FORMAT_CLE_HEX = /^[a-f0-9]{64}$/i;

const CLES_OBLIGATOIRES = [
  { nom: "JWT_SECRET", usage: "signature des jetons de session" },
  { nom: "BACKUP_ENCRYPTION_KEY", usage: "chiffrement des sauvegardes et archives WORM" },
  { nom: "CLE_CHIFFREMENT_NOTIFS", usage: "chiffrement des identifiants tiers au repos" },
  { nom: "CONTROL_HUB_SECRET_KEY", usage: "authentification du hub de contrôle" },
];

/**
 * Charge l'environnement approprié et vérifie les permissions du fichier .env
 */
function chargerEnvironnement() {
  const isTest = process.env.NODE_ENV === "test";

  if (isTest) {
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
    const cheminsProd = [
      path.join(process.cwd(), ".env"),
      path.join(__dirname, "..", "..", ".env"),
      path.join(__dirname, "..", ".env"),
      path.join(process.cwd(), "legal-notary-server", ".env"),
      "/var/www/legal-notary/legal-notary-server/.env",
      "/var/www/legal-notary/.env",
    ];
    for (const chemin of cheminsProd) {
      if (fs.existsSync(chemin)) {
        dotenv.config({ path: chemin });

        // Avertissement de sécurité si le fichier .env est lisible par d'autres que son propriétaire (chmod non restreint)
        try {
          if (process.platform !== "win32") {
            const stats = fs.statSync(chemin);
            const mode = stats.mode & 0o777;
            if ((mode & 0o077) !== 0) {
              console.warn(
                `[Sécurité] AVERTISSEMENT : Le fichier ${path.basename(chemin)} possède des droits trop permissifs (mode 0${mode.toString(8)}). Il devrait être restreint au propriétaire seul (chmod 600).`
              );
            }
          }
        } catch (_) {
          // Ignorer erreur d'inspection permissions
        }

        break;
      }
    }
  }

  dotenv.config(); // Fallback global
}

// Chargement initial
chargerEnvironnement();

/**
 * Valide l'ensemble des clés secrètes exigées
 * @param {object} options
 * @param {object} [options.env] - Objet d'environnement à tester (défaut: process.env)
 * @param {boolean} [options.quitterEnCasDErreur] - Si true, process.exit(1) en cas d'échec
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
function validerClesSecurite({ env = process.env, quitterEnCasDErreur = false } = {}) {
  const erreurs = [];
  const valeursVues = new Map();

  for (const { nom, usage } of CLES_OBLIGATOIRES) {
    const valeur = env[nom];

    // 1. Présence obligatoire
    if (!valeur || typeof valeur !== "string" || !valeur.trim()) {
      erreurs.push(
        `Clé secrète obligatoire manquante : ${nom} (${usage}). Définissez cette variable dans votre environnement.`
      );
      continue;
    }

    const trimmed = valeur.trim();

    // 2. Format strict exigé : exactement 64 caractères hexadécimaux (32 octets aléatoires)
    if (!FORMAT_CLE_HEX.test(trimmed)) {
      erreurs.push(
        `Format invalide pour ${nom} : doit comporter exactement 64 caractères hexadécimaux (32 octets aléatoires générés cryptographiquement). Tout autre format est refusé.`
      );
      continue;
    }

    // 3. Révocation : rejet des anciennes clés de secours révoquées via SHA-256
    const empreinte = crypto.createHash("sha256").update(trimmed).digest("hex");
    if (EMPREINTES_CLES_BANNIES.has(empreinte)) {
      erreurs.push(
        `Clé secrète révoquée pour ${nom} : cette valeur correspond à une ancienne clé de secours bannie pour des raisons de sécurité. Générez une nouvelle clé.`
      );
      continue;
    }

    // 4. Interdiction absolue de réutilisation ou retombée entre clés
    if (valeursVues.has(trimmed)) {
      const autreNom = valeursVues.get(trimmed);
      erreurs.push(
        `Réutilisation de clé interdite : ${nom} partage la même valeur que ${autreNom}. Chaque usage doit obligatoirement posséder une clé distincte.`
      );
    } else {
      valeursVues.set(trimmed, nom);
    }
  }

  const valide = erreurs.length === 0;

  if (!valide && quitterEnCasDErreur) {
    console.error("\n================================================================================");
    console.error("[CRITIQUE - SÉCURITÉ S04] ÉCHEC DE VALIDATION DES CLÉS SECRÈTES AU DÉMARRAGE :");
    for (const err of erreurs) {
      console.error(` ✖ ${err}`);
    }
    console.error("Le serveur refuse catégoriquement de démarrer avec une configuration compromise.");
    console.error("Consultez docs/CONFIGURATION.md ou lancez : npm run generer-cles");
    console.error("================================================================================\n");
    process.exit(1);
  }

  return { valide, erreurs };
}

module.exports = {
  config: {
    get jwtSecret() {
      return process.env.JWT_SECRET;
    },
    get backupEncryptionKey() {
      return process.env.BACKUP_ENCRYPTION_KEY;
    },
    get cleChiffrementNotifs() {
      return process.env.CLE_CHIFFREMENT_NOTIFS;
    },
    get controlHubSecretKey() {
      return process.env.CONTROL_HUB_SECRET_KEY;
    },
  },
  validerClesSecurite,
  chargerEnvironnement,
  FORMAT_CLE_HEX,
  CLES_OBLIGATOIRES,
  EMPREINTES_CLES_BANNIES,
};
