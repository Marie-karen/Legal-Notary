/**
 * js/tax-engine.js — Moteur fiscal pur de Legal Notary
 *
 * Fonctions pures, sans DOM, sans dépendance à LocalStorage : elles prennent
 * un montant/acte/paramètres en entrée et renvoient un résultat. Testées
 * unitairement (voir js/test-suite.js). Tous les montants manipulés sont des
 * francs CFA entiers (Math.round), jamais de flottant conservé en sortie.
 *
 * Chargé en <script> classique (pas de type="module"), voir js/data.js pour
 * l'explication du choix.
 */

var LegalNotary = window.LegalNotary || {};

LegalNotary.taxEngine = (function () {
  "use strict";

  function arrondi(n) {
    return Math.round(n);
  }

  // -----------------------------------------------------------------
  // Émoluments réglementés dégressifs (barème par tranches)
  // -----------------------------------------------------------------
  // tranches: [{ jusqua: number|null, taux: decimal }, ...] triées par ordre croissant
  function calculEmoluments(montant, tranches, minimumLegalMinute) {
    if (!montant || montant <= 0 || !tranches || !tranches.length) {
      return { montantHT: minimumLegalMinute || 0, detailTranches: [], minimumApplique: true };
    }
    var restant = montant;
    var borneInf = 0;
    var total = 0;
    var detail = [];
    for (var i = 0; i < tranches.length; i++) {
      var tranche = tranches[i];
      var borneSup = tranche.jusqua === null ? montant : Math.min(tranche.jusqua, montant);
      var largeur = borneSup - borneInf;
      if (largeur > 0) {
        var partiel = largeur * tranche.taux;
        total += partiel;
        detail.push({ de: borneInf, a: borneSup, taux: tranche.taux, montant: arrondi(partiel) });
      }
      borneInf = borneSup;
      if (borneInf >= montant) break;
    }
    total = arrondi(total);
    var minimumApplique = false;
    if (minimumLegalMinute && total < minimumLegalMinute) {
      total = minimumLegalMinute;
      minimumApplique = true;
    }
    return { montantHT: total, detailTranches: detail, minimumApplique: minimumApplique };
  }

  // -----------------------------------------------------------------
  // Droits d'enregistrement DGI
  // -----------------------------------------------------------------
  function calculDroitsEnregistrement(montant, droitEnregistrement) {
    if (!droitEnregistrement) return { montant: 0, aConfirmer: true };
    if (droitEnregistrement.montantFixe !== undefined && droitEnregistrement.montantFixe !== null) {
      return { montant: arrondi(droitEnregistrement.montantFixe), aConfirmer: !!droitEnregistrement.aConfirmer };
    }
    var taux = droitEnregistrement.taux || 0;
    return { montant: arrondi((montant || 0) * taux), aConfirmer: !!droitEnregistrement.aConfirmer };
  }

  // -----------------------------------------------------------------
  // Conservation Foncière : salaire du conservateur + frais fixes
  // -----------------------------------------------------------------
  function calculConservationFonciere(montant, parametresFiscaux, options) {
    options = options || {};
    var cf = parametresFiscaux.conservationFonciere;
    var salaireConservateur = arrondi((montant || 0) * cf.tauxSalaireConservateur);
    var inscription = options.avecInscription === false ? 0 : cf.inscriptionFonciereFixe;
    var radiation = options.avecRadiation ? cf.radiationFixe : 0;
    var total = salaireConservateur + inscription + radiation;
    return {
      salaireConservateur: salaireConservateur,
      inscriptionFonciere: inscription,
      radiation: radiation,
      total: total
    };
  }

  // -----------------------------------------------------------------
  // Timbre fiscal
  // -----------------------------------------------------------------
  function calculTimbreFiscal(nombreFeuilles, parametresFiscaux) {
    var n = nombreFeuilles || 1;
    return arrondi(n * parametresFiscaux.timbreFiscalParFeuille);
  }

  // -----------------------------------------------------------------
  // Rôles de minute
  // -----------------------------------------------------------------
  function calculRolesMinute(nombreRoles, parametresFiscaux) {
    var n = nombreRoles || 1;
    return arrondi(n * parametresFiscaux.tarifRoleMinute);
  }

  // -----------------------------------------------------------------
  // TVA sur émoluments/honoraires HT
  // -----------------------------------------------------------------
  function calculTVA(montantHT, parametresFiscaux) {
    return arrondi((montantHT || 0) * parametresFiscaux.tauxTVA);
  }

  // -----------------------------------------------------------------
  // Débours réglementaires
  // -----------------------------------------------------------------
  function calculDebours(options, parametresFiscaux) {
    options = options || {};
    var d = parametresFiscaux.debours;
    var papeterie = options.papeterie === false ? 0 : d.forfaitPapeterieAffranchissement;
    var expeditions = (options.nombreExpeditions || 0) * d.expeditionCopieAuthentiqueParUnite;
    var extraitTopo = options.extraitTopoCadastre ? d.extraitTopoCadastre : 0;
    var autres = options.autresDebours || 0;
    var total = papeterie + expeditions + extraitTopo + autres;
    return {
      papeterie: papeterie,
      expeditions: expeditions,
      extraitTopo: extraitTopo,
      autres: autres,
      total: total
    };
  }

  // -----------------------------------------------------------------
  // Pénalité de retard d'enregistrement (10% + 1%/mois de retard)
  // -----------------------------------------------------------------
  function calculPenaliteRetard(droitsEnregistrement, joursRetard, parametresFiscaux) {
    if (!joursRetard || joursRetard <= 0) return { applicable: false, montant: 0 };
    var p = parametresFiscaux.penaliteRetardEnregistrement;
    var moisRetard = Math.ceil(joursRetard / 30);
    var montant = arrondi(droitsEnregistrement * p.tauxFixe + droitsEnregistrement * p.tauxMensuel * moisRetard);
    return { applicable: true, moisRetard: moisRetard, montant: montant };
  }

  // -----------------------------------------------------------------
  // Devis / fiche de taxe complète pour un dossier
  // -----------------------------------------------------------------
  // acte: entrée du catalogue (LegalNotary.data.getActe(...))
  // montant: assiette (montant de la vente/du prêt/du capital...)
  // parametresFiscaux: LegalNotary.data.PARAMETRES_FISCAUX_DEFAUT (ou surchargé par l'étude)
  // baremeEmoluments: LegalNotary.data.BAREME_EMOLUMENTS_DEFAUT (ou surchargé par l'étude)
  // options: { nombreFeuilles, nombreRoles, nombreExpeditions, extraitTopoCadastre,
  //            avecInscriptionFonciere, avecRadiation, joursRetardEnregistrement }
  function calculerFicheDeTaxe(acte, montant, parametresFiscaux, baremeEmoluments, options) {
    options = options || {};
    montant = montant || 0;

    var famille = acte ? acte.bareme : "minimum_minute";
    var tranches = (famille !== "minimum_minute" && baremeEmoluments[famille]) ? baremeEmoluments[famille] : [];
    var emoluments = calculEmoluments(montant, tranches, parametresFiscaux.minimumLegalMinute);

    var droits = calculDroitsEnregistrement(montant, acte ? acte.droitEnregistrement : null);
    var conservation = calculConservationFonciere(montant, parametresFiscaux, {
      avecInscription: options.avecInscriptionFonciere,
      avecRadiation: options.avecRadiation
    });
    var timbre = calculTimbreFiscal(options.nombreFeuilles, parametresFiscaux);
    var roles = calculRolesMinute(options.nombreRoles, parametresFiscaux);
    var debours = calculDebours(options, parametresFiscaux);
    var tva = calculTVA(emoluments.montantHT, parametresFiscaux);
    var penalite = calculPenaliteRetard(droits.montant, options.joursRetardEnregistrement, parametresFiscaux);

    var totalTresor = droits.montant + conservation.total + timbre + penalite.montant;
    var totalEmolumentsTTC = emoluments.montantHT + tva + roles;
    var totalDebours = debours.total;
    var totalGeneral = totalTresor + totalEmolumentsTTC + totalDebours;

    return {
      acte: acte ? { id: acte.id, label: acte.label } : null,
      montantAssiette: montant,
      emoluments: emoluments,
      droitsEnregistrement: droits,
      conservationFonciere: conservation,
      timbreFiscal: timbre,
      rolesMinute: roles,
      debours: debours,
      tva: tva,
      penaliteRetard: penalite,
      totaux: {
        tresor: totalTresor,
        emolumentsTTC: totalEmolumentsTTC,
        debours: totalDebours,
        general: totalGeneral
      }
    };
  }

  return {
    arrondi: arrondi,
    calculEmoluments: calculEmoluments,
    calculDroitsEnregistrement: calculDroitsEnregistrement,
    calculConservationFonciere: calculConservationFonciere,
    calculTimbreFiscal: calculTimbreFiscal,
    calculRolesMinute: calculRolesMinute,
    calculTVA: calculTVA,
    calculDebours: calculDebours,
    calculPenaliteRetard: calculPenaliteRetard,
    calculerFicheDeTaxe: calculerFicheDeTaxe
  };
})();
