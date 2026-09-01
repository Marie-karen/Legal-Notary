/**
 * src/services/excel.service.js — Remplissage automatique des matrices Excel de liquidation notariale.
 *
 * Conserve fidèlement la forme, le format, les formules et la mise en page
 * des fichiers Excel d'étude (TEST.xlsx et modèles TP d'actes).
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DOSSIER_MODELES_DEFAUT = path.resolve(__dirname, "../../../");
const DOSSIER_MODELES_PERSO = path.resolve(__dirname, "../../data/modeles_excel");

// S'assurer que le dossier des modèles personnalisés existe
if (!fs.existsSync(DOSSIER_MODELES_PERSO)) {
  fs.mkdirSync(DOSSIER_MODELES_PERSO, { recursive: true });
}

/**
 * Liste tous les modèles Excel disponibles (modèles de base du cabinet + modèles importés)
 */
function listerModelesExcel() {
  const modeles = [];

  // Modèles racine
  const fichiersRacine = [
    { id: "TEST", nom: "Modèle Standard Officiel (TEST.xlsx - 4 Feuilles)", fichier: "TEST.xlsx", parDefaut: true },
    { id: "TP_VENTE_ACQUEREUR", nom: "Vente Immobilière — Côté Acquéreur (TP VENTE ACQUEREUR.xlsx)", fichier: "TP VENTE  (ACQUEREUR).xlsx" },
    { id: "TP_VENTE_VENDEUR", nom: "Vente Immobilière — Côté Vendeur (TP VENTE VENDEUR.xlsx)", fichier: "TP VENTE  (VENDEUR).xlsx" },
    { id: "TP_PROMESSE_VENTE", nom: "Promesse de Vente (TP PROMESSE DE VENTE.xlsx)", fichier: "TP PROMESSE DE VENTE   (ACQUEREUR).xlsx" },
    { id: "TP_REALISATION_PROMESSE", nom: "Réalisation de Promesse (TP REALISATION PROMESSE.xlsx)", fichier: "TP DE REALISATION DE LA PROMESSE DE VENTE.xlsx" },
    { id: "TP_DONATION", nom: "Donation Entre Vifs (TP DE DONATION.xlsx)", fichier: "TP DE DONATION.xlsx" },
    { id: "TP_CONSTITUTION_SARL", nom: "Constitution SARL (TP CONSTITUTION D'UNE SARL.xlsx)", fichier: "TP CONSTITUTION D'UNE SARL  AU CAPITAL DE 1 000 000 FCFA.xlsx" },
    { id: "TP_AUGMENTATION_CAPITAL", nom: "Augmentation de Capital (TP AUGMENTATION DE CAPITAL.xlsx)", fichier: "TP AUGMENTATION DE CAPITAL.xlsx" },
    { id: "TP_PROCURATION", nom: "Procuration Notariée (TP PROCURATION.xlsx)", fichier: "TP PROCURATION.xlsx" },
  ];

  for (const m of fichiersRacine) {
    const fullPath = path.join(DOSSIER_MODELES_DEFAUT, m.fichier);
    if (fs.existsSync(fullPath)) {
      modeles.push({
        id: m.id,
        nom: m.nom,
        fichier: m.fichier,
        type: "standard",
        parDefaut: !!m.parDefaut,
        taille: fs.statSync(fullPath).size,
      });
    }
  }

  // Modèles personnalisés téléversés par l'étude
  if (fs.existsSync(DOSSIER_MODELES_PERSO)) {
    const fichiersPerso = fs.readdirSync(DOSSIER_MODELES_PERSO);
    for (const f of fichiersPerso) {
      if (f.endsWith(".xlsx") || f.endsWith(".xls")) {
        const fullPath = path.join(DOSSIER_MODELES_PERSO, f);
        modeles.push({
          id: "perso_" + f,
          nom: "Modèle Étude : " + f.replace(/\.xlsx?$/, ""),
          fichier: f,
          type: "personnalise",
          parDefaut: false,
          taille: fs.statSync(fullPath).size,
        });
      }
    }
  }

  return modeles;
}

/**
 * Résout le chemin absolu d'un modèle Excel donné
 */
function obtenirCheminModele(modeleIdOuFichier) {
  if (!modeleIdOuFichier || modeleIdOuFichier === "TEST" || modeleIdOuFichier === "default") {
    return path.join(DOSSIER_MODELES_DEFAUT, "TEST.xlsx");
  }

  // Vérifier dans les modèles personnalisés
  const cheminPerso = path.join(DOSSIER_MODELES_PERSO, String(modeleIdOuFichier).replace(/^perso_/, ""));
  if (fs.existsSync(cheminPerso)) return cheminPerso;

  // Vérifier dans les modèles de base
  const cheminRacine = path.join(DOSSIER_MODELES_DEFAUT, String(modeleIdOuFichier));
  if (fs.existsSync(cheminRacine)) return cheminRacine;

  const liste = listerModelesExcel();
  const trouve = liste.find((m) => m.id === modeleIdOuFichier || m.fichier === modeleIdOuFichier);
  if (trouve) {
    if (trouve.type === "personnalise") return path.join(DOSSIER_MODELES_PERSO, trouve.fichier);
    return path.join(DOSSIER_MODELES_DEFAUT, trouve.fichier);
  }

  return path.join(DOSSIER_MODELES_DEFAUT, "TEST.xlsx");
}

/**
 * Remplit automatiquement le classeur Excel officiel avec les données de la fiche de taxe et du dossier.
 * Conserve 100% de la structure, des formules et des mises en page sans altération.
 */
function genererFichierExcelLiquidation(dossier, fiche, parametres, modeleId) {
  const cheminModele = obtenirCheminModele(modeleId);
  
  if (!fs.existsSync(cheminModele)) {
    throw new Error(`Modèle Excel introuvable à l'emplacement : ${cheminModele}`);
  }

  const wb = XLSX.readFile(cheminModele, {
    cellStyles: true,
    cellNF: true,
    cellDates: true,
    cellFormula: true,
  });

  const baseSheet = wb.Sheets["BASE"];
  const montantAssiette = Number(dossier.montantAssiette || dossier.montant_assiette) || 0;
  const clientNom = dossier.comparantsNoms || dossier.clientNom || dossier.client_nom || "CLIENT DU DOSSIER";
  const numDossier = dossier.numeroDossier || dossier.numero_dossier || "DOSSIER";
  const dateJour = new Date().toLocaleDateString("fr-CI");

  const emo = fiche.emoluments || {};
  const totaux = fiche.totaux || {};
  const saisies = fiche.saisies || {};
  const timbres = saisies.timbres || {};

  const pagesMin = Number(timbres.pagesMinute) || 4;
  const nbExp = Number(timbres.nombreExpeditions) || 2;
  const pagesExp = Number(timbres.pagesExpedition) || (pagesMin + 1);

  // 1. Remplissage de la feuille 'BASE' si elle existe (Architecture type TEST.xlsx)
  if (baseSheet) {
    // Base de calcul
    baseSheet["C2"] = { t: "n", v: montantAssiette };
    // Pages minute
    baseSheet["C4"] = { t: "n", v: pagesMin };
    // Pages expédition
    baseSheet["C5"] = { t: "n", v: pagesExp };
    // Nombre d'expéditions
    baseSheet["C6"] = { t: "n", v: nbExp };

    // Comparants / Désignation
    baseSheet["F9"] = { t: "s", v: clientNom };
    // Nature de l'acte
    baseSheet["F10"] = { t: "s", v: (dossier.typeActeLibelle || dossier.type_acte_libelle || "ACTE NOTARIÉ").toUpperCase() };
    // Date
    baseSheet["F11"] = { t: "s", v: dateJour };

    // Droits fixes Enregistrement
    const ligneDGI = (fiche.lignesTresor || []).find((t) => t.code === "dgi_fixe" || t.code === "enregistrement_dgi");
    if (ligneDGI && baseSheet["C13"]) {
      baseSheet["C13"] = { t: "n", v: ligneDGI.montant };
    }

    // Droits fixes taxe foncière
    const ligneFoncierFixe = (fiche.lignesTresor || []).find((t) => t.code === "taxe_fonciere_fixe");
    if (ligneFoncierFixe && baseSheet["C14"]) {
      baseSheet["C14"] = { t: "n", v: ligneFoncierFixe.montant };
    }

    // Émoluments proportionnels
    const montantEmolHT = totaux.emolumentsHT || emo.montantHT || emo.totalEmolumentsHT || 0;
    if (baseSheet["C20"]) {
      baseSheet["C20"] = { t: "n", v: montantEmolHT };
    }
  }

  // 2. Remplissage de la feuille 'FICHE DE TAXE' si elle existe
  const taxSheet = wb.Sheets["FICHE DE TAXE"];
  if (taxSheet) {
    if (taxSheet["C6"]) taxSheet["C6"] = { t: "s", v: clientNom };
    if (taxSheet["D9"]) taxSheet["D9"] = { t: "n", v: montantAssiette };

    // Mise à jour de l'en-tête de l'étude
    if (parametres && parametres.nomNotaire) {
      if (taxSheet["B1"]) taxSheet["B1"] = { t: "s", v: `${parametres.titreNotaire || "Maître"} ${parametres.nomNotaire}` };
    }
  }

  // 3. Remplissage de la feuille 'NOTE DE FRAIS' si elle existe
  const noteSheet = wb.Sheets["NOTE DE FRAIS"];
  if (noteSheet) {
    if (parametres && parametres.nomEtude && noteSheet["A1"]) {
      noteSheet["A1"] = { t: "s", v: parametres.nomEtude };
    }
    if (noteSheet["A12"]) noteSheet["A12"] = { t: "s", v: `Identité du client : ${clientNom}` };
    if (noteSheet["A15"]) noteSheet["A15"] = { t: "s", v: `Numéro de dossier : ${numDossier}` };
    if (noteSheet["A17"]) noteSheet["A17"] = { t: "s", v: `Base de calcul : ${montantAssiette.toLocaleString("fr-FR")} FRANCS/CFA` };
  }

  // 4. Remplissage de la feuille 'FACTURE NORMALISE' si elle existe
  const factureSheet = wb.Sheets["FACTURE NORMALISE"];
  if (factureSheet) {
    if (factureSheet["C6"]) factureSheet["C6"] = { t: "s", v: clientNom };
    if (factureSheet["C10"]) factureSheet["C10"] = { t: "s", v: numDossier };
    if (factureSheet["C29"]) factureSheet["C29"] = { t: "s", v: `TOTAL GENERAL : ${(totaux.general || 0).toLocaleString("fr-FR")} FCFA` };
  }

  // Générer et retourner le tampon binaire XLSX
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Enregistre un nouveau modèle Excel personnalisé téléversé par l'étude
 */
function enregistrerModelePersonnalise(nomFichier, buffer) {
  const nomSecurise = nomFichier.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destination = path.join(DOSSIER_MODELES_PERSO, nomSecurise);
  fs.writeFileSync(destination, buffer);
  return {
    id: "perso_" + nomSecurise,
    nom: "Modèle Étude : " + nomSecurise.replace(/\.xlsx?$/, ""),
    fichier: nomSecurise,
    taille: buffer.length,
  };
}

module.exports = {
  listerModelesExcel,
  obtenirCheminModele,
  genererFichierExcelLiquidation,
  enregistrerModelePersonnalise,
};
