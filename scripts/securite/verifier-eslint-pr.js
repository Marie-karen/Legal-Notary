#!/usr/bin/env node
/**
 * scripts/securite/verifier-eslint-pr.js
 * 
 * Chaîne de contrôle automatique — Étape C0 (Cahier des charges, Section 15 bis C & Décision C0)
 * Règle : Bloque UNIQUEMENT les NOUVELLES erreurs introduites par rapport à la baseline (eslint-baseline.json).
 * Les erreurs préexistantes sont tolérées et traitées au fil des étapes (S01 à S25).
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RACINE_PROJET = path.resolve(__dirname, "..", "..");
const DOSSIER_SERVER = path.join(RACINE_PROJET, "legal-notary-server");
const FICHIER_BASELINE = path.join(DOSSIER_SERVER, "eslint-baseline.json");

function obtenirFichiersModifies() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args;
  }

  // En CI sur PR ou push : détecter les fichiers JS modifiés
  const commandesDiff = [
    "git diff --name-only origin/main...HEAD",
    "git diff --name-only origin/main",
    "git diff --name-only HEAD~1",
    "git diff --cached --name-only",
  ];

  for (const cmd of commandesDiff) {
    try {
      const out = execSync(cmd, { cwd: RACINE_PROJET, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const fichiers = out
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.endsWith(".js") && (f.startsWith("legal-notary-server/") || !f.includes("/")));
      if (fichiers.length > 0) {
        return fichiers.map((f) => f.replace(/^legal-notary-server\//, ""));
      }
    } catch (_) {}
  }

  return [];
}

function verifier() {
  if (!fs.existsSync(FICHIER_BASELINE)) {
    console.error(`[verifier-eslint-pr] ❌ Fichier de baseline introuvable : ${FICHIER_BASELINE}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(FICHIER_BASELINE, "utf8"));
  const fichiersModifies = obtenirFichiersModifies();

  console.log("--------------------------------------------------------------------------------");
  console.log("🔍 CONTRÔLE QUALITÉ ESLINT : DÉTECTION DES NOUVELLES ERREURS (C0)");
  console.log("--------------------------------------------------------------------------------");

  if (fichiersModifies.length === 0) {
    console.log("ℹ️ Aucun fichier JavaScript modifié détecté. Exécution de vérification globale contre baseline...");
  } else {
    console.log(`ℹ️ ${fichiersModifies.length} fichier(s) JavaScript modifié(s) analysé(s) :`);
    fichiersModifies.forEach((f) => console.log(`   - ${f}`));
  }

  let sortieJson = "";
  try {
    const cibles = fichiersModifies.length > 0 ? fichiersModifies.join(" ") : '"src/**/*.js" "tests/**/*.js" "scripts/**/*.js"';
    sortieJson = execSync(`./node_modules/.bin/eslint ${cibles} -f json`, {
      cwd: DOSSIER_SERVER,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (errExec) {
    sortieJson = errExec.stdout || "";
  }

  let resultats = [];
  try {
    resultats = JSON.parse(sortieJson || "[]");
  } catch (errJson) {
    console.error("[verifier-eslint-pr] ❌ Impossible de parser le rapport JSON d'ESLint:", errJson.message);
    process.exit(1);
  }

  const nouvellesErreurs = [];

  for (const item of resultats) {
    const relPath = item.filePath.split("/legal-notary-server/")[1] || path.relative(DOSSIER_SERVER, item.filePath);
    const baseInfo = baseline[relPath] || { errors: 0, warnings: 0, messages: [] };

    // Vérifier si de nouvelles erreurs (severity 2) ont été ajoutées
    const erreursActuelles = item.messages.filter((m) => m.severity === 2);
    const nbErreursActuelles = erreursActuelles.length;
    const nbErreursBaseline = baseInfo.errors || 0;

    if (nbErreursActuelles > nbErreursBaseline) {
      const surplus = nbErreursActuelles - nbErreursBaseline;
      erreursActuelles.forEach((m) => {
        nouvellesErreurs.push({
          fichier: relPath,
          ligne: m.line,
          regle: m.ruleId,
          message: m.message,
        });
      });
    }
  }

  if (nouvellesErreurs.length > 0) {
    console.error("\n================================================================================");
    console.error("❌ ÉCHEC : NOUVELLE(S) ERREUR(S) ESLINT DÉTECTÉE(S) PAR RAPPORT À LA BASELINE");
    console.error("================================================================================");
    nouvellesErreurs.forEach((e) => {
      console.error(`  - ${e.fichier}:${e.ligne} [${e.regle}] ${e.message}`);
    });
    console.error("================================================================================");
    console.error(`Total : ${nouvellesErreurs.length} nouvelle(s) erreur(s). Corrigez ces erreurs avant fusion.`);
    console.error("================================================================================\n");
    process.exit(1);
  }

  console.log("✅ Contrôle ESLint réussi : aucune nouvelle erreur introduite par rapport à la baseline.");
  process.exit(0);
}

verifier();
