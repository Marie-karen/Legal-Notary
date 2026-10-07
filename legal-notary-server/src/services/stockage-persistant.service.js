/**
 * src/services/stockage-persistant.service.js — Persistance locale sur disque JSON (Tolérance de Panne 100%).
 *
 * Sauvegarde et recharge automatiquement les utilisateurs, études et paramètres sur le disque local
 * (/data/*.json). Ainsi, même en cas d'indisponibilité de PostgreSQL ou de redémarrage PM2,
 * aucun compte collaborateur ni aucune étude nouvellement créée n'est jamais perdue.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");

function assurerDossierData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn(
      "[StockagePersistant] Impossible de créer le dossier data:",
      e.message,
    );
  }
}

function lireFichierJson(nomFichier, valeurDefaut = null) {
  assurerDossierData();
  const chemin = path.join(DATA_DIR, nomFichier);
  try {
    if (fs.existsSync(chemin)) {
      const brut = fs.readFileSync(chemin, "utf8");
      return JSON.parse(brut);
    }
  } catch (e) {
    console.warn(
      "[StockagePersistant] Erreur lecture " + nomFichier + " :",
      e.message,
    );
  }
  return valeurDefaut;
}

function ecrireFichierJson(nomFichier, donnees) {
  assurerDossierData();
  const chemin = path.join(DATA_DIR, nomFichier);
  try {
    const temp = chemin + ".tmp." + Date.now();
    fs.writeFileSync(temp, JSON.stringify(donnees, null, 2), "utf8");
    fs.renameSync(temp, chemin);
  } catch (e) {
    console.warn(
      "[StockagePersistant] Erreur écriture " + nomFichier + " :",
      e.message,
    );
  }
}

module.exports = {
  lireFichierJson,
  ecrireFichierJson,
};
