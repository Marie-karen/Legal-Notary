#!/usr/bin/env node
/**
 * scripts/securite/verifier-fichiers-interdits.js
 * 
 * Chaîne de contrôle automatique — Étape C0 (Cahier des charges, Section 15 bis C)
 * Règle stricte : Refuse catégoriquement tout fichier interdit dans le dépôt Git :
 *  - Fichiers Excel (.xlsx)
 *  - Fichiers PDF (.pdf)
 *  - Fichiers d'environnement (.env, .env.test, .env.local...) SAUF .env.example
 *  - Tout fichier sous le dossier uploads/
 */

const { execSync } = require("child_process");
const path = require("path");

function obtenirFichiersSuivis() {
  try {
    const stdout = execSync("git ls-files", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return stdout.split("\n").map(f => f.trim()).filter(Boolean);
  } catch (err) {
    console.error("[verifier-fichiers-interdits] Erreur lors de l'exécution de git ls-files:", err.message);
    process.exit(1);
  }
}

function obtenirFichiersStaged() {
  try {
    const stdout = execSync("git diff --cached --name-only", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return stdout.split("\n").map(f => f.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function estFichierInterdit(cheminRelatif) {
  const normalise = cheminRelatif.replace(/\\/g, "/");
  const nomFichier = path.basename(normalise);

  // 1. Fichiers Excel (.xlsx)
  if (normalise.endsWith(".xlsx")) {
    return { interdit: true, raison: "Fichier Excel (.xlsx) interdit dans le dépôt (secret professionnel / données sensibles)" };
  }

  // 2. Fichiers PDF (.pdf)
  if (normalise.endsWith(".pdf")) {
    return { interdit: true, raison: "Fichier PDF (.pdf) interdit dans le dépôt (actes, guides ou pièces sensibles)" };
  }

  // 3. Dossier uploads/
  if (normalise.startsWith("uploads/") || normalise.includes("/uploads/")) {
    return { interdit: true, raison: "Dossier uploads/ interdit dans le dépôt (stockage de fichiers applicatifs / sauvegardes)" };
  }

  // 4. Fichiers .env
  // Règle explicite C0 : Seul .env.example est autorisé. .env.test et tout autre .env sont formellement refusés.
  if (nomFichier === ".env.example") {
    return { interdit: false };
  }

  if (nomFichier.startsWith(".env") || nomFichier.endsWith(".env") || /(^|\/)\.env(\.|$)/.test(normalise)) {
    return {
      interdit: true,
      raison: nomFichier === ".env.test"
        ? ".env.test interdit dans le dépôt (doit être configuré via variables d'environnement CI et rester dans .gitignore)"
        : "Fichier d'environnement (.env) interdit dans le dépôt (risque de fuite de secrets)"
    };
  }

  return { interdit: false };
}

function verifier() {
  const tousFichiers = Array.from(new Set([...obtenirFichiersSuivis(), ...obtenirFichiersStaged()]));
  const infractions = [];

  for (const fichier of tousFichiers) {
    const resultat = estFichierInterdit(fichier);
    if (resultat.interdit) {
      infractions.push({ fichier, raison: resultat.raison });
    }
  }

  if (infractions.length > 0) {
    console.error("\n================================================================================");
    console.error("❌ ÉCHEC DU CONTRÔLE DE SÉCURITÉ : FICHIERS INTERDITS DÉTECTÉS DANS LE DÉPÔT");
    console.error("   (Cahier des charges, Section 15 bis C & Étape C0)");
    console.error("================================================================================");
    infractions.forEach(({ fichier, raison }) => {
      console.error(`  - ${fichier} : ${raison}`);
    });
    console.error("================================================================================");
    console.error(`Total : ${infractions.length} fichier(s) interdit(s).`);
    console.error("Ces fichiers doivent être retirés de Git et purgés de l'historique (traité par S12).");
    console.error("================================================================================\n");
    process.exit(1);
  }

  console.log("✅ Contrôle de sécurité réussi : aucun fichier interdit (.xlsx, .pdf, .env non-example, uploads/) dans le dépôt.");
  process.exit(0);
}

verifier();
