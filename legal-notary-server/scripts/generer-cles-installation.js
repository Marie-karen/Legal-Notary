#!/usr/bin/env node
/**
 * scripts/generer-cles-installation.js — Générateur de clés cryptographiques d'installation (Correctif S04).
 *
 * Exigences de sécurité strictes (Section 3 bis & 15 bis) :
 * 1. Clés générées via crypto.randomBytes(32).toString('hex') (64 hex = 256 bits d'entropie).
 * 2. Écrit directement dans le fichier cible (droits 600 appliqués automatiquement).
 * 3. Refuse formellement d'écraser des clés existantes sans l'option explicite --force.
 * 4. N'affiche JAMAIS la valeur d'une clé, seulement les noms des variables générées.
 *
 * Utilisation :
 *   node scripts/generer-cles-installation.js
 *   node scripts/generer-cles-installation.js --env-file=.env --force
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const NOMS_CLES = ["JWT_SECRET", "BACKUP_ENCRYPTION_KEY", "CLE_CHIFFREMENT_NOTIFS", "CONTROL_HUB_SECRET_KEY"];

function executer() {
  const args = process.argv.slice(2);
  const forcer = args.includes("--force") || args.includes("--forcer");

  let cheminCible = path.join(process.cwd(), ".env");
  const argChemin = args.find((a) => a.startsWith("--env-file="));
  if (argChemin) {
    cheminCible = path.resolve(process.cwd(), argChemin.split("=")[1]);
  } else if (!fs.existsSync(cheminCible)) {
    // Si exécuté depuis la racine du monorepo
    const cheminAlt = path.join(process.cwd(), "legal-notary-server", ".env");
    if (fs.existsSync(cheminAlt)) {
      cheminCible = cheminAlt;
    }
  }

  let contenuExistant = "";
  let existe = false;

  if (fs.existsSync(cheminCible)) {
    existe = true;
    contenuExistant = fs.readFileSync(cheminCible, "utf8");
    const clesPresentes = NOMS_CLES.filter((nom) => {
      const regex = new RegExp(`^\\s*${nom}\\s*=`, "m");
      return regex.test(contenuExistant);
    });

    if (clesPresentes.length > 0 && !forcer) {
      console.error(`\n[GénérateurClés] ERREUR : Le fichier ${cheminCible} contient déjà des clés secrètes :`);
      for (const k of clesPresentes) {
        console.error(` - ${k} (déjà définie)`);
      }
      console.error(
        "Pour des raisons de sécurité, aucune clé n'a été écrasée. Ajoutez l'option '--force' si vous souhaitez remplacer ces clés.\n"
      );
      process.exit(1);
    }
  }

  // Génération des 4 clés aléatoires (32 octets = 64 caractères hexadécimaux)
  const nouvellesCles = {};
  for (const nom of NOMS_CLES) {
    nouvellesCles[nom] = crypto.randomBytes(32).toString("hex");
  }

  let nouveauContenu = contenuExistant;
  if (existe) {
    for (const nom of NOMS_CLES) {
      const regex = new RegExp(`^\\s*${nom}\\s*=.*$`, "m");
      if (regex.test(nouveauContenu)) {
        nouveauContenu = nouveauContenu.replace(regex, `${nom}=${nouvellesCles[nom]}`);
      } else {
        nouveauContenu += (nouveauContenu.endsWith("\n") ? "" : "\n") + `${nom}=${nouvellesCles[nom]}\n`;
      }
    }
  } else {
    nouveauContenu = [
      "# Configuration Legal Notary — Générée par scripts/generer-cles-installation.js",
      "NODE_ENV=production",
      "PORT=4000",
      `JWT_SECRET=${nouvellesCles.JWT_SECRET}`,
      `BACKUP_ENCRYPTION_KEY=${nouvellesCles.BACKUP_ENCRYPTION_KEY}`,
      `CLE_CHIFFREMENT_NOTIFS=${nouvellesCles.CLE_CHIFFREMENT_NOTIFS}`,
      `CONTROL_HUB_SECRET_KEY=${nouvellesCles.CONTROL_HUB_SECRET_KEY}`,
      "",
    ].join("\n");
  }

  fs.writeFileSync(cheminCible, nouveauContenu, "utf8");

  // Application des permissions 600 (lecture/écriture uniquement par le propriétaire)
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(cheminCible, 0o600);
    } catch (errChmod) {
      console.warn(`[GénérateurClés] Avertissement chmod 600 : ${errChmod.message}`);
    }
  }

  console.log(`\n[GénérateurClés] Succès : clés secrètes enregistrées dans ${cheminCible} (permissions 600) :`);
  for (const nom of NOMS_CLES) {
    console.log(` ✔ ${nom} : [GÉNÉRÉE — 64 caractères hexadécimaux]`);
  }
  console.log("Sécurité respectée : les valeurs ne sont jamais affichées dans les logs de la console.\n");
}

if (require.main === module) {
  executer();
}

module.exports = { executer, NOMS_CLES };
