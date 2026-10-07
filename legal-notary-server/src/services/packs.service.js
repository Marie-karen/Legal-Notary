/**
 * src/services/packs.service.js — Moteur de gestion des Packs Régionaux et Packs Pays (Lot 0 Multi-pays & Multilingue).
 *
 * Implémente :
 * 1. L'héritage dynamique des packs : Régional (ex. OHADA-UEMOA) -> Pays (ex. Côte d'Ivoire, Sénégal, Test)
 * 2. La fourniture des monnaies, fuseaux horaires, indicatifs, jours fériés, barèmes et administrations
 * 3. La validation et la compilation instantanée (< 1ms) en mémoire
 */

const fs = require("fs");
const path = require("path");

const CHEMIN_PACKS_REGIONAL = path.join(__dirname, "..", "packs", "regional");
const CHEMIN_PACKS_PAYS = path.join(__dirname, "..", "packs", "pays");

const CACHE_PACKS_REGIONAL = new Map();
const CACHE_PACKS_PAYS_BRUTS = new Map();
const CACHE_PACKS_COMPILES = new Map();

function chargerPacksDepuisDisque() {
  try {
    if (fs.existsSync(CHEMIN_PACKS_REGIONAL)) {
      const fichiersReg = fs.readdirSync(CHEMIN_PACKS_REGIONAL);
      for (const f of fichiersReg) {
        if (f.endsWith(".json")) {
          const contenu = JSON.parse(fs.readFileSync(path.join(CHEMIN_PACKS_REGIONAL, f), "utf8"));
          CACHE_PACKS_REGIONAL.set(contenu.code, contenu);
        }
      }
    }

    if (fs.existsSync(CHEMIN_PACKS_PAYS)) {
      const fichiersPays = fs.readdirSync(CHEMIN_PACKS_PAYS);
      for (const f of fichiersPays) {
        if (f.endsWith(".json")) {
          const contenu = JSON.parse(fs.readFileSync(path.join(CHEMIN_PACKS_PAYS, f), "utf8"));
          CACHE_PACKS_PAYS_BRUTS.set(contenu.code, contenu);
        }
      }
    }
  } catch (err) {
    console.warn("[Packs Service] Erreur lors de la lecture des packs :", err.message);
  }
}

// Chargement initial
chargerPacksDepuisDisque();

/**
 * Fusion profonde d'objets pour l'héritage
 */
function fusionnerObjets(cible, source) {
  if (!source) return cible;
  const resultat = { ...cible };
  for (const [cle, val] of Object.entries(source)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      resultat[cle] = fusionnerObjets(cible[cle] || {}, val);
    } else {
      resultat[cle] = val;
    }
  }
  return resultat;
}

/**
 * Obtient un pack pays compilé avec tout son héritage régional
 */
function obtenirPackPays(codePays = "ci") {
  const codeNormalise = String(codePays || "ci").toLowerCase().trim();
  if (CACHE_PACKS_COMPILES.has(codeNormalise)) {
    return CACHE_PACKS_COMPILES.get(codeNormalise);
  }

  const packBrut = CACHE_PACKS_PAYS_BRUTS.get(codeNormalise) || CACHE_PACKS_PAYS_BRUTS.get("ci");
  if (!packBrut) {
    // Fallback minimal de sécurité
    return {
      code: "ci",
      nom: "Côte d'Ivoire",
      monnaie: { code: "XOF", symbole: "FCFA", libelle: "Franc CFA", decimales: 0 },
      fuseauHoraire: "Africa/Abidjan",
      indicatifTelephonique: "+225",
      langueDefaut: "fr",
      fiscalite: { tauxTva: 0.18, timbreFiscalPage: 500, emolumentRolePage: 500 },
      joursFeries: [],
      administrations: {}
    };
  }

  const codeRegional = packBrut.packRegional || "ohada-uemoa";
  const packRegional = CACHE_PACKS_REGIONAL.get(codeRegional) || {};

  // Héritage : Pack Régional écrasé/étendu par Pack Pays
  const packCompile = fusionnerObjets(packRegional, packBrut);

  // Fusion intelligente des barèmes
  const baremesFinaux = Array.isArray(packBrut.baremes) && packBrut.baremes.length > 0
    ? packBrut.baremes
    : (Array.isArray(packRegional.baremes) ? packRegional.baremes : []);
  packCompile.baremes = baremesFinaux;

  CACHE_PACKS_COMPILES.set(codeNormalise, packCompile);
  return packCompile;
}

/**
 * Liste tous les packs pays disponibles pour le déploiement (exclut les brouillons par défaut)
 */
function listerPacksPays(options = {}) {
  const { inclureBrouillons = false } = options;
  const liste = [];
  for (const code of CACHE_PACKS_PAYS_BRUTS.keys()) {
    const p = obtenirPackPays(code);
    if (!inclureBrouillons && p.proposeAuDeploiement === false) {
      continue;
    }
    liste.push({
      code: p.code,
      nom: p.nom,
      statut: p.statut || "valide",
      proposeAuDeploiement: p.proposeAuDeploiement !== false,
      monnaie: p.monnaie,
      fuseauHoraire: p.fuseauHoraire,
      indicatifTelephonique: p.indicatifTelephonique,
      langueDefaut: p.langueDefaut,
      languesDisponibles: p.languesDisponibles || ["fr"],
      tauxTva: p.fiscalite?.tauxTva ?? 0.18,
      timbreFiscalPage: p.fiscalite?.timbreFiscalPage ?? 500,
      totalJoursFeries: Array.isArray(p.joursFeries) ? p.joursFeries.length : 0,
      administrations: p.administrations,
      textesReference: p.textesReference || []
    });
  }
  return liste;
}

/**
 * Vérifie si une date correspond à un jour férié pour un pack pays
 */
function estJourFerie(dateObj, codePays = "ci") {
  const pack = obtenirPackPays(codePays);
  const mois = dateObj.getMonth() + 1; // 1-12
  const jour = dateObj.getDate();

  if (Array.isArray(pack.joursFeries)) {
    return pack.joursFeries.some((f) => f.mois === mois && f.jour === jour);
  }
  return false;
}

/**
 * Calcul du montant formaté avec le symbole et la devise du pack pays
 */
function formaterMontantDevise(montant, codePays = "ci") {
  const pack = obtenirPackPays(codePays);
  const val = Math.round(Number(montant) || 0);
  const formatted = val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const symbole = pack.monnaie?.symbole || pack.monnaie?.code || "FCFA";
  return `${formatted} ${symbole}`;
}

module.exports = {
  obtenirPackPays,
  listerPacksPays,
  estJourFerie,
  formaterMontantDevise,
  rechargerPacks: chargerPacksDepuisDisque,
};
