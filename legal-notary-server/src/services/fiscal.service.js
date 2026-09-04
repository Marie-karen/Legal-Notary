/**
 * src/services/fiscal.service.js — Moteur de calcul notarial, fiscal et d'émoluments.
 *
 * Moteur pur (aucune dépendance DB ni Express), conforme à :
 * 1. Décret N° 2013-279 du 24/04/2013 (Tarification des actes notariés en Côte d'Ivoire)
 * 2. Code Général des Impôts (CGI CI - Droits d'enregistrement & publicité foncière)
 * 3. Pratique réelle des Études Notariales de Côte d'Ivoire (analyses des 11 fiches réelles TP)
 *
 * Règles invariables :
 * - Timbres fiscaux légaux : 500 FCFA / page (Minutes = 500*pages, Expéditions = 500*(pages+1)*nbExp, Bordereau = 500)
 * - Émoluments de rôles : 500 FCFA / page (Minutes = 500*pages, Expéditions = 500*(pages+1)*nbExp, Copies = 500*(pages+1)*nbCopies)
 * - Taxe foncière publicité foncière : 1,2 % proportionnel + 3 000 FCFA fixe
 * - TVA légale sur honoraires du Notaire : 18 %
 * - Décomposition intégrale des émoluments ligne par ligne (Chiffre d'Affaires de l'Étude).
 */

function arrondi(n) {
  return Math.round(Number(n) || 0);
}

/**
 * Conversion d'un montant entier en toutes lettres (Francs CFA)
 * Respecte les règles d'accord grammatical en français.
 */
function nombreEnLettresFCFA(montant) {
  const n = Math.floor(Math.abs(Number(montant) || 0));
  if (n === 0) return "ZÉRO FRANC CFA";

  const unites = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF"];
  const dix_dixneuf = ["DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
  const dizaines = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGT", "QUATRE-VINGT-DIX"];

  function convertirCentaines(val) {
    let res = "";
    const c = Math.floor(val / 100);
    const r = val % 100;

    if (c > 0) {
      if (c === 1) res += "CENT";
      else res += unites[c] + " CENT" + (r === 0 ? "S" : "");
    }

    if (r > 0) {
      if (res !== "") res += " ";
      if (r < 10) {
        res += unites[r];
      } else if (r >= 10 && r < 20) {
        res += dix_dixneuf[r - 10];
      } else if (r >= 20 && r < 70) {
        const d = Math.floor(r / 10);
        const u = r % 10;
        if (u === 1) res += dizaines[d] + " ET UN";
        else if (u > 1) res += dizaines[d] + "-" + unites[u];
        else res += dizaines[d];
      } else if (r >= 70 && r < 80) {
        const u = r % 10;
        if (u === 1) res += "SOIXANTE ET ONZE";
        else res += "SOIXANTE-" + dix_dixneuf[u];
      } else if (r >= 80 && r < 90) {
        const u = r % 10;
        if (u === 0) res += "QUATRE-VINGTS";
        else res += "QUATRE-VINGT-" + unites[u];
      } else if (r >= 90 && r < 100) {
        const u = r % 10;
        res += "QUATRE-VINGT-" + dix_dixneuf[u];
      }
    }
    return res;
  }

  const milliards = Math.floor(n / 1000000000);
  const millions = Math.floor((n % 1000000000) / 1000000);
  const milliers = Math.floor((n % 1000000) / 1000);
  const reste = n % 1000;

  const morceaux = [];

  if (milliards > 0) {
    if (milliards === 1) morceaux.push("UN MILLIARD");
    else morceaux.push(convertirCentaines(milliards) + " MILLIARDS");
  }

  if (millions > 0) {
    if (millions === 1) morceaux.push("UN MILLION");
    else morceaux.push(convertirCentaines(millions) + " MILLIONS");
  }

  if (milliers > 0) {
    if (milliers === 1) morceaux.push("MILLE");
    else morceaux.push(convertirCentaines(milliers) + " MILLE");
  }

  if (reste > 0) {
    morceaux.push(convertirCentaines(reste));
  }

  return morceaux.join(" ") + " FRANCS CFA";
}

/**
 * Émoluments réglementés dégressifs par tranches ou formules d'usage.
 */
function calculEmoluments(montant, tranches, minimumLegalMinute = 50000) {
  montant = Number(montant) || 0;
  const baremeNom = (tranches && tranches.baremeNom) || null;
  const baremeCode = (tranches && tranches.baremeCode) || null;
  const formuleSpeciale = (tranches && tranches.formuleSpeciale) || null;

  // Formules spéciales de la pratique d'Étude
  if (formuleSpeciale) {
    if (formuleSpeciale === "vente_usage") {
      const mt = arrondi((montant * 0.01) + 400000);
      return {
        montantHT: mt,
        detailTranches: [{ de: 0, a: montant, taux: 0.01, montant: mt }],
        minimumApplique: false,
        baremeNom: baremeNom || "Barème Vente (Pratique Étude)",
        baremeCode: "vente_usage",
        libelleRegle: "Formule d'usage Vente : (Base × 1%) + 400 000 FCFA",
      };
    }
    if (formuleSpeciale === "promesse_vente_3_4") {
      const baseCalc = (montant * 0.005) + 850000;
      const mt = arrondi(baseCalc * 0.75);
      return {
        montantHT: mt,
        detailTranches: [{ de: 0, a: montant, taux: 0.005, montant: mt }],
        minimumApplique: false,
        baremeNom: baremeNom || "Promesse de Vente (3/4)",
        baremeCode: "promesse_vente_3_4",
        libelleRegle: "Promesse de Vente : ((Base × 0,5%) + 850 000) × 3/4",
      };
    }
    if (formuleSpeciale === "realisation_promesse_1_4") {
      const baseCalc = (montant * 0.005) + 850000;
      const mt = arrondi(baseCalc * 0.25);
      return {
        montantHT: mt,
        detailTranches: [{ de: 0, a: montant, taux: 0.005, montant: mt }],
        minimumApplique: false,
        baremeNom: baremeNom || "Réalisation Promesse (1/4)",
        baremeCode: "realisation_promesse_1_4",
        libelleRegle: "Réalisation Promesse : ((Base × 0,5%) + 850 000) × 1/4",
      };
    }
    if (formuleSpeciale === "donation") {
      const mt = arrondi((montant * 0.005) + 850000);
      return {
        montantHT: mt,
        detailTranches: [{ de: 0, a: montant, taux: 0.005, montant: mt }],
        minimumApplique: false,
        baremeNom: baremeNom || "Barème Donation",
        baremeCode: "donation",
        libelleRegle: "Donation : (Base × 0,5%) + 850 000 FCFA",
      };
    }
  }

  if (!montant || montant <= 0 || !tranches || !tranches.length) {
    return {
      montantHT: minimumLegalMinute || 50000,
      detailTranches: [],
      minimumApplique: true,
      baremeNom,
      baremeCode,
      libelleRegle: `Émolument forfaitaire / Minimum légal de minute (${minimumLegalMinute || 50000} FCFA — Décret N° 2013-279)`,
    };
  }

  let borneInf = 0;
  let total = 0;
  const detail = [];
  for (const tranche of tranches) {
    const borneSup = tranche.jusqua === null ? montant : Math.min(tranche.jusqua, montant);
    const largeur = borneSup - borneInf;
    if (largeur > 0) {
      const partiel = largeur * tranche.taux;
      total += partiel;
      detail.push({ de: borneInf, a: borneSup, taux: tranche.taux, montant: arrondi(partiel) });
    }
    borneInf = borneSup;
    if (borneInf >= montant) break;
  }
  total = arrondi(total);
  let minimumApplique = false;
  let libelleRegle = baremeNom || "Barème proportionnel dégressif (Décret N° 2013-279)";

  if (minimumLegalMinute && total < minimumLegalMinute) {
    total = minimumLegalMinute;
    minimumApplique = true;
    libelleRegle = `Minimum légal de minute (${minimumLegalMinute} FCFA — Art. 19 Décret N° 2013-279)`;
  }
  return { montantHT: total, detailTranches: detail, minimumApplique, baremeNom, baremeCode, libelleRegle };
}

/**
 * Droit d'enregistrement DGI de l'acte.
 */
function calculDroitEnregistrement(montant, regle) {
  if (!regle || regle.mode === "a_confirmer") {
    return { montant: 0, confirme: false };
  }
  if (regle.mode === "fixe") {
    return { montant: arrondi(regle.valeur), confirme: true };
  }
  return { montant: arrondi((montant || 0) * (Number(regle.valeur) || 0)), confirme: true };
}

/**
 * Taxe foncière de publicité foncière (1,2 % proportionnel + 3 000 FCFA fixe).
 */
function calculTaxeFonciere(montant, parametresEtude = {}) {
  const taux = parametresEtude.taxeFonciereTauxProportionnel !== undefined ? Number(parametresEtude.taxeFonciereTauxProportionnel) : 0.012;
  const fixe = parametresEtude.taxeFonciereDroitFixe !== undefined ? Number(parametresEtude.taxeFonciereDroitFixe) : 3000;
  const proportionnel = arrondi((Number(montant) || 0) * taux);
  return { proportionnel, fixe, total: proportionnel + fixe };
}

/**
 * Calculs de documents et timbres / rôles basés sur le nombre de pages (500 F/page).
 * Règle invariable légale :
 * - Minute = pagesMinute * 500 F
 * - Expéditions = pagesExpedition * nombreExpeditions * 500 F
 * - Troisième document = pagesTroisiemeDocument * 500 F
 */
function calculDocumentsPage(quantites = {}, tarifParPage = 500) {
  const pagesMinute = Number(quantites.pagesMinute) || 0;
  const pagesExpedition = Number(quantites.pagesExpedition) || 0;
  const nombreExpeditions = Number(quantites.nombreExpeditions) || 0;
  const pagesTroisiemeDocument = Number(quantites.pagesTroisiemeDocument) || 0;

  const minute = arrondi(pagesMinute * tarifParPage);
  const expedition = arrondi(pagesExpedition * nombreExpeditions * tarifParPage);
  const troisiemeDocument = arrondi(pagesTroisiemeDocument * tarifParPage);
  return { minute, expedition, troisiemeDocument, total: minute + expedition + troisiemeDocument };
}

function calculTVA(montantHT, tauxTVA = 0.18) {
  return arrondi((Number(montantHT) || 0) * (Number(tauxTVA) || 0.18));
}

/**
 * Catalogue standard des lignes d'émoluments, formalités et débours
 */
function obtenirCatalogueLignesStandard(typeActe = {}, montant = 0) {
  return [
    // ÉMOLUMENTS DE FORMALITÉS
    { id: "emol_inscription_livre_foncier", code: "inscription_livre_foncier", categorie: "formalite", libelle: "Inscription au Livre Foncier", montantDefaut: 75000, actif: true },
    { id: "emol_extrait_topographique", code: "extrait_topographique", categorie: "formalite", libelle: "Demande d'extrait topographique (Cadastre)", montantDefaut: 15000, actif: true },
    { id: "emol_requisition_fonciere", code: "requisition_fonciere", categorie: "formalite", libelle: "Réquisitions foncières", montantDefaut: 10000, actif: true },
    { id: "emol_bordereau_enregistrement", code: "bordereau_enregistrement", categorie: "formalite", libelle: "Émoluments de bordereau d'enregistrement", montantDefaut: 1000, actif: true },
    { id: "emol_taxe_fonciere_formalite", code: "taxe_fonciere_formalite", categorie: "formalite", libelle: "Émolument de la taxe foncière", montantDefaut: 75000, actif: true },
    { id: "emol_etats_fonciers", code: "etats_fonciers", categorie: "formalite", libelle: "Demande d'états fonciers (Conservation)", montantDefaut: 30000, actif: true },
    { id: "emol_situation_fiscale", code: "situation_fiscale", categorie: "formalite", libelle: "Demande d'attestation de situation fiscale", montantDefaut: 15000, actif: true },
    { id: "emol_certificat_mutation", code: "certificat_mutation", categorie: "formalite", libelle: "Certificat de mutation foncière", montantDefaut: 75000, actif: false },
    { id: "emol_certificat_localisation", code: "certificat_localisation", categorie: "formalite", libelle: "Émolument du certificat de localisation", montantDefaut: 15000, actif: false },
    { id: "emol_depot_banque", code: "depot_banque", categorie: "formalite", libelle: "Dépôt à la banque", montantDefaut: 15000, actif: false },
    { id: "emol_depot_enregistrement", code: "depot_enregistrement", categorie: "formalite", libelle: "Dépôt à l'enregistrement", montantDefaut: 15000, actif: false },
    { id: "emol_modification_rccm", code: "modification_rccm", categorie: "formalite", libelle: "Modification RCCM (Greffe)", montantDefaut: 15000, actif: false },
    { id: "emol_publication_legale", code: "publication_legale", categorie: "formalite", libelle: "Publication légale d'annonces", montantDefaut: 15000, actif: false },
    { id: "emol_declaration_beneficiaires", code: "declaration_beneficiaires", categorie: "formalite", libelle: "Déclaration des bénéficiaires effectifs", montantDefaut: 15000, actif: false },
    { id: "emol_bulletins_souscription", code: "bulletins_souscription", categorie: "formalite", libelle: "Bulletins de souscription", montantDefaut: 100000, actif: false },

    // VACATIONS, DÉPLACEMENTS ET ART. 135
    { id: "emol_vacations", code: "vacations", categorie: "vacation", libelle: "Vacations du Notaire (Signature / Clôture)", montantDefaut: 150000, actif: false },
    { id: "emol_transport", code: "transport", categorie: "deplacement", libelle: "Frais de transport aller/retour", montantDefaut: 81000, actif: false },
    { id: "emol_deplacement_sejour", code: "deplacement_sejour", categorie: "deplacement", libelle: "Frais de déplacement et de séjour", montantDefaut: 40000, actif: false },
    { id: "emol_art_135", code: "art_135", categorie: "art135", libelle: "Honoraires de conseil & diligence (Art. 135)", montantDefaut: 20000, actif: false },
    { id: "emol_divers_papeterie", code: "divers_papeterie", categorie: "divers", libelle: "Frais de correspondance, affranchissement et papeterie", montantDefaut: 20000, actif: false },

    // DÉBOURS TIERS
    { id: "debours_dossier_technique", code: "debours_dossier_technique", categorie: "debours", libelle: "Dossier technique / Morcellement géomètre", montantDefaut: 150000, actif: false },
    { id: "debours_certificat_localisation", code: "debours_certificat_localisation", categorie: "debours", libelle: "Certificat de localisation (Frais réels)", montantDefaut: 250000, actif: false },
    { id: "debours_registres_tribunal", code: "debours_registres_tribunal", categorie: "debours", libelle: "Registres légaux & Paraphe Tribunal de Commerce", montantDefaut: 470000, actif: false },
    { id: "debours_divers_formalites", code: "debours_divers_formalites", categorie: "debours", libelle: "Débours divers de formalités", montantDefaut: 100000, actif: false },
  ];
}

/**
 * Moteur de calcul complet de la Fiche de Taxe, de la Note de Frais et de la Facture Normalisée.
 */
function calculerFicheDeTaxe(typeActe, montant, parametresEtude = {}, tranchesBareme = [], saisies = {}) {
  montant = Number(montant) || 0;
  saisies = saisies || {};
  parametresEtude = {
    tauxTVA: 0.18,
    minimumLegalMinute: 50000,
    tarifPageTimbre: 500,
    tarifPageRole: 500,
    taxeFonciereTauxProportionnel: 0.012,
    taxeFonciereDroitFixe: 3000,
    forfaitDivers: 20000,
    ...parametresEtude,
  };

  // 1. Émolument proportionnel d'acte
  const emolumentsProportionnels = calculEmoluments(montant, tranchesBareme, parametresEtude.minimumLegalMinute);

  // 2. Droits d'Enregistrement DGI
  const droitEnregistrement = calculDroitEnregistrement(montant, {
    mode: typeActe.droitEnregistrementMode || "pourcentage",
    valeur: typeActe.droitEnregistrementValeur !== undefined ? typeActe.droitEnregistrementValeur : 0.04,
  });

  // 3. Taxe Foncière (Livre Foncier)
  const taxeFonciere = typeActe.taxeFonciereApplicable
    ? calculTaxeFonciere(montant, parametresEtude)
    : { proportionnel: 0, fixe: 0, total: 0 };

  // 4. Droits de Timbre Fiscal (Invariables : 500 F / page)
  const qteTimbres = saisies.timbres || {};
  const timbres = calculDocumentsPage(
    {
      pagesMinute: qteTimbres.pagesMinute,
      pagesExpedition: qteTimbres.pagesExpedition,
      nombreExpeditions: qteTimbres.nombreExpeditions,
      pagesTroisiemeDocument: qteTimbres.pagesBordereau !== undefined ? qteTimbres.pagesBordereau : (qteTimbres.pagesTroisiemeDocument !== undefined ? qteTimbres.pagesTroisiemeDocument : 0),
    },
    parametresEtude.tarifPageTimbre
  );

  // 5. Émoluments de Rôles (Invariables : 500 F / page)
  const qteRoles = saisies.roles || {};
  const roles = calculDocumentsPage(
    {
      pagesMinute: qteRoles.pagesMinute,
      pagesExpedition: qteRoles.pagesExpedition,
      nombreExpeditions: qteRoles.nombreExpeditions,
      pagesTroisiemeDocument: qteRoles.pagesCopie !== undefined ? qteRoles.pagesCopie : (qteRoles.pagesTroisiemeDocument !== undefined ? qteRoles.pagesTroisiemeDocument : 0),
    },
    parametresEtude.tarifPageRole
  );

  // 6. Vacations et Frais de formalités
  const vacations = arrondi(saisies.vacations || 0);
  const ff = saisies.fraisFormalites || {};
  const fraisFormalites = {
    depotBanque: arrondi(ff.depotBanque || 0),
    depotEnregistrement: arrondi(ff.depotEnregistrement || 0),
    inscriptionLivreFoncier: arrondi(ff.inscriptionLivreFoncier || 0),
    requisitionEtat: arrondi(ff.requisitionEtat || 0),
  };
  const totalFraisFormalites =
    fraisFormalites.depotBanque + fraisFormalites.depotEnregistrement +
    fraisFormalites.inscriptionLivreFoncier + fraisFormalites.requisitionEtat;

  const divers = parametresEtude.forfaitDivers + arrondi(saisies.diversSupplementaire || 0);

  const honorairesHT = emolumentsProportionnels.montantHT + vacations;
  const tva = calculTVA(honorairesHT, parametresEtude.tauxTVA);

  const totalDroitsEtat = droitEnregistrement.montant + taxeFonciere.total + timbres.total;
  const totalHonoraires = honorairesHT + tva + roles.total;
  const totalFormalitesEtDivers = totalFraisFormalites + divers;
  const totalGeneral = totalDroitsEtat + totalHonoraires + totalFormalitesEtDivers;
  const totalGeneralEnLettres = nombreEnLettresFCFA(totalGeneral);

  // 7. Lignes détaillées d'émoluments (Chiffre d'Affaires de l'Étude)
  const catalogueStandard = obtenirCatalogueLignesStandard(typeActe, montant);
  const saisiesLignes = saisies.lignesEmoluments || [];

  const lignesEmolumentsDetaillees = [
    {
      code: "emolument_proportionnel_acte",
      categorie: "acte",
      libelle: "Émoluments proportionnels",
      montant: emolumentsProportionnels.montantHT,
      actif: true,
      fixe: false,
    },
  ];

  if (roles.minute > 0) {
    lignesEmolumentsDetaillees.push({
      code: "roles_redaction_minute",
      categorie: "role",
      libelle: `* Émoluments de rôles Minutes (${qteRoles.pagesMinute || 0} pages × 500 F)`,
      montant: roles.minute,
      actif: true,
      fixe: true,
    });
  }
  if (roles.expedition > 0) {
    lignesEmolumentsDetaillees.push({
      code: "roles_redaction_expedition",
      categorie: "role",
      libelle: `* Émoluments de rôles Expéditions (${qteRoles.nombreExpeditions || 0} exp. × ${qteRoles.pagesExpedition || 0} p. × 500 F)`,
      montant: roles.expedition,
      actif: true,
      fixe: true,
    });
  }
  if (roles.troisiemeDocument > 0) {
    lignesEmolumentsDetaillees.push({
      code: "roles_redaction_copies",
      categorie: "role",
      libelle: `* Émoluments de rôles Copies (${qteRoles.pagesCopie || 0} pages × 500 F)`,
      montant: roles.troisiemeDocument,
      actif: true,
      fixe: true,
    });
  }

  // Ajout des formalités actives
  if (fraisFormalites.inscriptionLivreFoncier > 0) {
    lignesEmolumentsDetaillees.push({ code: "inscription_livre_foncier", categorie: "formalite", libelle: "Inscription au Livre Foncier", montant: fraisFormalites.inscriptionLivreFoncier, actif: true });
  }
  if (fraisFormalites.requisitionEtat > 0) {
    lignesEmolumentsDetaillees.push({ code: "requisition_fonciere", categorie: "formalite", libelle: "Réquisitions foncières", montant: fraisFormalites.requisitionEtat, actif: true });
  }
  if (fraisFormalites.depotBanque > 0) {
    lignesEmolumentsDetaillees.push({ code: "depot_banque", categorie: "formalite", libelle: "Dépôt à la banque", montant: fraisFormalites.depotBanque, actif: true });
  }
  if (fraisFormalites.depotEnregistrement > 0) {
    lignesEmolumentsDetaillees.push({ code: "depot_enregistrement", categorie: "formalite", libelle: "Dépôt à l'enregistrement", montant: fraisFormalites.depotEnregistrement, actif: true });
  }
  if (vacations > 0) {
    lignesEmolumentsDetaillees.push({ code: "vacations", categorie: "vacation", libelle: "Vacations du Notaire", montant: vacations, actif: true });
  }
  if (divers > 0) {
    lignesEmolumentsDetaillees.push({ code: "divers_papeterie", categorie: "divers", libelle: "Frais de correspondance et papeterie", montant: divers, actif: true });
  }

  // Traitement des lignes additionnelles personnalisées
  saisiesLignes.forEach((s) => {
    if (s.actif && !lignesEmolumentsDetaillees.some((l) => l.code === s.code)) {
      lignesEmolumentsDetaillees.push({
        id: s.id,
        code: s.code,
        categorie: s.categorie || "formalite",
        libelle: s.libelle,
        montant: arrondi(s.montant),
        actif: true,
      });
    }
  });

  // Lignes Trésor et Débours détaillées
  const lignesTresor = [];
  if (timbres.minute > 0) lignesTresor.push({ code: "timbres_minute", libelle: `Timbres fiscaux — Minute (${qteTimbres.pagesMinute || 0} pages × 500 F)`, montant: timbres.minute });
  if (timbres.expedition > 0) lignesTresor.push({ code: "timbres_expedition", libelle: `Timbres fiscaux — Expéditions (${qteTimbres.nombreExpeditions || 0} exp. × ${qteTimbres.pagesExpedition || 0} p. × 500 F)`, montant: timbres.expedition });
  if (timbres.troisiemeDocument > 0) lignesTresor.push({ code: "timbres_bordereau", libelle: `Timbres fiscaux — Bordereau (${qteTimbres.pagesBordereau || 0} p. × 500 F)`, montant: timbres.troisiemeDocument });
  if (droitEnregistrement.montant > 0) lignesTresor.push({ code: "droit_enregistrement", libelle: `Droits d'enregistrement DGI (${typeActe.droitEnregistrementMode === "fixe" ? "Droit fixe" : (typeActe.droitEnregistrementValeur * 100) + " %"})`, montant: droitEnregistrement.montant });
  if (taxeFonciere.total > 0) lignesTresor.push({ code: "taxe_fonciere", libelle: `Taxe de publicité foncière (1,2 % + 3 000 FCFA)`, montant: taxeFonciere.total });

  const lignesDebours = [];
  saisiesLignes.filter(s => s.categorie === "debours" && s.actif).forEach(s => {
    lignesDebours.push({ code: s.code, libelle: s.libelle || "Frais débours tiers", montant: arrondi(s.montant) });
  });

  const totalDeboursCalc = lignesDebours.reduce((acc, d) => acc + d.montant, 0);

  return {
    typeActe: { id: typeActe.id, libelle: typeActe.libelle },
    montantAssiette: montant,
    emoluments: {
      ...emolumentsProportionnels,
      lignesDetaillees: lignesEmolumentsDetaillees,
      totalEmolumentsHT: emolumentsProportionnels.montantHT + vacations + totalFraisFormalites + roles.total + divers,
    },
    droitEnregistrement,
    taxeFonciere,
    timbres,
    roles,
    vacations,
    fraisFormalites,
    totalFraisFormalites,
    divers,
    tva,
    lignesTresor,
    lignesDebours,
    totaux: {
      droitsEtat: totalDroitsEtat,
      tresor: totalDroitsEtat,
      debours: totalDeboursCalc,
      honoraires: totalHonoraires,
      formalitesEtDivers: totalFormalitesEtDivers,
      general: totalGeneral + totalDeboursCalc,
      generalEnLettres: nombreEnLettresFCFA(totalGeneral + totalDeboursCalc),
      emolumentsHT: emolumentsProportionnels.montantHT + vacations + totalFraisFormalites + roles.total + divers,
      factureNormaliseeTTC: totalDroitsEtat + totalDeboursCalc + (emolumentsProportionnels.montantHT + vacations + totalFraisFormalites + roles.total + divers) + tva,
    },
  };
}

module.exports = {
  arrondi,
  nombreEnLettresFCFA,
  calculEmoluments,
  calculDroitEnregistrement,
  calculTaxeFonciere,
  calculDocumentsPage,
  calculTVA,
  obtenirCatalogueLignesStandard,
  calculerFicheDeTaxe,
};
