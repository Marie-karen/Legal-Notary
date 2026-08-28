/**
 * src/services/fiscal.service.js — Moteur fiscal (fonctions pures).
 *
 * Aucune dépendance à Express ni à la base de données ici : ce fichier ne
 * fait QUE du calcul, à partir de trois entrées explicites (règles de
 * l'acte, paramètres du cabinet, saisies du dossier). C'est ce qui permet
 * de le tester unitairement sans base de données (voir tests/fiscal.test.js)
 * et de le réutiliser tel quel si l'interface change un jour.
 *
 * Origine des règles de calcul : Décret N° 2013-279 du 24/04/2013 pour les
 * barèmes d'émoluments dégressifs (vente/société/prêt) et les droits
 * d'enregistrement confirmés (vente 4%, bail 2,5%, prêt 1,5%, succession
 * 3%) ; et des documents réels du cabinet (TEST 1.xlsx — fiche de taxe,
 * note de frais, facture normalisée d'une mainlevée d'hypothèque réelle)
 * pour :
 *   - la taxe foncière : 1,2 % proportionnel + 3 000 FCFA fixe (et NON pas
 *     1 % comme une première hypothèse le supposait avant vérification) ;
 *   - les timbres fiscaux et les rôles de minute : 500 FCFA par page, par
 *     document (minute / expédition / copie / bordereau), et non un
 *     montant fixe par feuille comme une première hypothèse le supposait ;
 *   - le forfait "divers" (papeterie/affranchissement) : 20 000 FCFA,
 *     confirmé exact ;
 *   - un exemple chiffré de mainlevée d'hypothèque qui valide le barème
 *     dégressif "prêt" du décret (2 % / 1 % / 0,5 % / 0,25 %) et son droit
 *     d'enregistrement fixe de 18 000 FCFA pour ce type d'acte précis.
 *
 * Tout ce qui n'est pas confirmé par l'un de ces deux sources reste
 * délibérément conservateur (0, ou minimum légal de minute) plutôt
 * qu'inventé — voir NOTES_HYPOTHESES.md à la racine du projet.
 */

function arrondi(n) {
  return Math.round(n);
}

/**
 * Émoluments réglementés dégressifs, par tranches.
 * @param {number} montant
 * @param {Array<{jusqua: number|null, taux: number}>} tranches triées par ordre croissant
 * @param {number} minimumLegalMinute
 */
function calculEmoluments(montant, tranches, minimumLegalMinute) {
  if (!montant || montant <= 0 || !tranches || !tranches.length) {
    return { montantHT: minimumLegalMinute || 0, detailTranches: [], minimumApplique: true };
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
  if (minimumLegalMinute && total < minimumLegalMinute) {
    total = minimumLegalMinute;
    minimumApplique = true;
  }
  return { montantHT: total, detailTranches: detail, minimumApplique };
}

/**
 * Droit d'enregistrement DGI de l'acte.
 * @param {number} montant
 * @param {{mode: 'pourcentage'|'fixe'|'a_confirmer', valeur: number}} regle
 */
function calculDroitEnregistrement(montant, regle) {
  if (!regle || regle.mode === "a_confirmer") {
    return { montant: 0, confirme: false };
  }
  if (regle.mode === "fixe") {
    return { montant: arrondi(regle.valeur), confirme: true };
  }
  return { montant: arrondi((montant || 0) * regle.valeur), confirme: true };
}

/**
 * Taxe foncière (uniquement pour les actes qui portent sur un bien
 * immobilier avec inscription/mutation) : 1,2 % du montant + 3 000 FCFA
 * fixe. Confirmé par un exemple réel (mainlevée d'hypothèque, base
 * 158 200 000 FCFA → 1 898 400 FCFA de proportionnel, soit exactement
 * 1,2 %).
 */
function calculTaxeFonciere(montant, parametresEtude) {
  const proportionnel = arrondi((montant || 0) * parametresEtude.taxeFonciereTauxProportionnel);
  const fixe = parametresEtude.taxeFonciereDroitFixe;
  return { proportionnel, fixe, total: proportionnel + fixe };
}

/**
 * Timbres fiscaux / rôles de minute : 500 FCFA (paramétrable) par page,
 * pour chaque document produit (minute, expédition — multipliée par le
 * nombre d'exemplaires —, et un troisième document dont le nom varie
 * selon la catégorie : "Bordereau d'enregistrement" pour les timbres,
 * "Copie" pour les rôles). Les quantités sont saisies au cas par cas par
 * le comptable taxateur : il n'existe pas de ratio fixe entre elles dans
 * les documents réels observés.
 *
 * @param {{ pagesMinute: number, pagesExpedition: number, nombreExpeditions: number, pagesTroisiemeDocument: number }} quantites
 * @param {number} tarifParPage
 */
function calculDocumentsPage(quantites, tarifParPage) {
  const minute = arrondi((quantites.pagesMinute || 0) * tarifParPage);
  const expedition = arrondi((quantites.pagesExpedition || 0) * (quantites.nombreExpeditions || 0) * tarifParPage);
  const troisiemeDocument = arrondi((quantites.pagesTroisiemeDocument || 0) * tarifParPage);
  return { minute, expedition, troisiemeDocument, total: minute + expedition + troisiemeDocument };
}

function calculTVA(montantHT, tauxTVA) {
  return arrondi((montantHT || 0) * tauxTVA);
}

/**
 * Calcule la fiche de taxe complète d'un dossier.
 *
 * @param {object} typeActe - ligne de la table types_actes (camelCase, voir dossiers.service.js pour le mapping)
 * @param {number} montant - montant_assiette du dossier
 * @param {object} parametresEtude - ligne de parametres_etude (camelCase)
 * @param {Array} tranchesBareme - tranches du barème d'émoluments applicable (vide si aucun => minimum de minute)
 * @param {object} saisies - quantités et frais case par case saisis par le comptable :
 *   {
 *     timbres: { pagesMinute, pagesExpedition, nombreExpeditions, pagesBordereau },
 *     roles:   { pagesMinute, pagesExpedition, nombreExpeditions, pagesCopie },
 *     vacations: number,
 *     fraisFormalites: { depotBanque, depotEnregistrement, inscriptionLivreFoncier, requisitionEtat },
 *     diversSupplementaire: number,
 *   }
 */
function calculerFicheDeTaxe(typeActe, montant, parametresEtude, tranchesBareme, saisies = {}) {
  montant = montant || 0;
  saisies = saisies || {};

  const emoluments = calculEmoluments(montant, tranchesBareme, parametresEtude.minimumLegalMinute);
  const droitEnregistrement = calculDroitEnregistrement(montant, {
    mode: typeActe.droitEnregistrementMode,
    valeur: typeActe.droitEnregistrementValeur,
  });
  const taxeFonciere = typeActe.taxeFonciereApplicable
    ? calculTaxeFonciere(montant, parametresEtude)
    : { proportionnel: 0, fixe: 0, total: 0 };

  const timbres = calculDocumentsPage(
    { ...saisies.timbres, pagesTroisiemeDocument: saisies.timbres && saisies.timbres.pagesBordereau },
    parametresEtude.tarifPageTimbre
  );
  const roles = calculDocumentsPage(
    { ...saisies.roles, pagesTroisiemeDocument: saisies.roles && saisies.roles.pagesCopie },
    parametresEtude.tarifPageRole
  );

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

  const honorairesHT = emoluments.montantHT + vacations;
  const tva = calculTVA(honorairesHT, parametresEtude.tauxTVA);

  const totalDroitsEtat = droitEnregistrement.montant + taxeFonciere.total + timbres.total;
  const totalHonoraires = honorairesHT + tva + roles.total;
  const totalFormalitesEtDivers = totalFraisFormalites + divers;
  const totalGeneral = totalDroitsEtat + totalHonoraires + totalFormalitesEtDivers;

  return {
    typeActe: { id: typeActe.id, libelle: typeActe.libelle },
    montantAssiette: montant,
    emoluments,
    droitEnregistrement,
    taxeFonciere,
    timbres,
    roles,
    vacations,
    fraisFormalites,
    totalFraisFormalites,
    divers,
    tva,
    totaux: {
      droitsEtat: totalDroitsEtat,
      honoraires: totalHonoraires,
      formalitesEtDivers: totalFormalitesEtDivers,
      general: totalGeneral,
    },
  };
}

module.exports = {
  arrondi,
  calculEmoluments,
  calculDroitEnregistrement,
  calculTaxeFonciere,
  calculDocumentsPage,
  calculTVA,
  calculerFicheDeTaxe,
};
