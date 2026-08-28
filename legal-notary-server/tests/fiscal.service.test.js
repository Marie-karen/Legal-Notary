/**
 * tests/fiscal.service.test.js — Tests du moteur fiscal.
 *
 * Utilise le testeur intégré de Node.js (`node --test`, voir package.json)
 * pour éviter une dépendance supplémentaire à installer sur le serveur du
 * cabinet. Aucune base de données requise : le moteur fiscal est constitué
 * de fonctions pures (voir src/services/fiscal.service.js).
 *
 * Chaque test référence sa source (Décret 2013-279, ou l'exemple réel de
 * mainlevée d'hypothèque du cabinet) pour qu'un futur développeur sache
 * pourquoi le chiffre attendu est celui-là, et ne le "corrige" pas par
 * erreur.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fiscal = require("../src/services/fiscal.service");

const PARAMETRES_DEFAUT = {
  tauxTVA: 0.18,
  minimumLegalMinute: 50000,
  tarifPageTimbre: 500,
  tarifPageRole: 500,
  taxeFonciereTauxProportionnel: 0.012,
  taxeFonciereDroitFixe: 3000,
  forfaitDivers: 20000,
};

const BAREME_VENTE = [
  { jusqua: 10000000, taux: 0.04 },
  { jusqua: 30000000, taux: 0.025 },
  { jusqua: 90000000, taux: 0.015 },
  { jusqua: null, taux: 0.0075 },
];

const BAREME_PRET = [
  { jusqua: 10000000, taux: 0.02 },
  { jusqua: 30000000, taux: 0.01 },
  { jusqua: 90000000, taux: 0.005 },
  { jusqua: null, taux: 0.0025 },
];

test("émoluments — Décret 2013-279 : tranche unique (vente 5M)", () => {
  const r = fiscal.calculEmoluments(5000000, BAREME_VENTE, 50000);
  assert.equal(r.montantHT, 200000); // 5 000 000 × 4 %
});

test("émoluments — Décret 2013-279 : deux tranches cumulées (vente 20M)", () => {
  const r = fiscal.calculEmoluments(20000000, BAREME_VENTE, 50000);
  // 10M×4% + 10M×2,5% = 400 000 + 250 000
  assert.equal(r.montantHT, 650000);
});

test("émoluments — Décret 2013-279 : quatre tranches cumulées (vente 100M)", () => {
  const r = fiscal.calculEmoluments(100000000, BAREME_VENTE, 50000);
  // 10M×4% + 20M×2,5% + 60M×1,5% + 10M×0,75% = 400000+500000+900000+75000
  assert.equal(r.montantHT, 1875000);
});

test("émoluments — le minimum légal de minute s'applique sur un petit montant", () => {
  const r = fiscal.calculEmoluments(100000, BAREME_VENTE, 50000);
  assert.equal(r.montantHT, 50000);
  assert.equal(r.minimumApplique, true);
});

test("émoluments — montant nul retombe sur le minimum légal (jamais 0, jamais bloquant)", () => {
  const r = fiscal.calculEmoluments(0, BAREME_VENTE, 50000);
  assert.equal(r.montantHT, 50000);
});

test("droit d'enregistrement — pourcentage (vente 4% sur 10M)", () => {
  const r = fiscal.calculDroitEnregistrement(10000000, { mode: "pourcentage", valeur: 0.04 });
  assert.equal(r.montant, 400000);
  assert.equal(r.confirme, true);
});

test("droit d'enregistrement — fixe confirmé (mainlevée d'hypothèque, exemple réel du cabinet : 18 000 FCFA)", () => {
  const r = fiscal.calculDroitEnregistrement(999, { mode: "fixe", valeur: 18000 });
  assert.equal(r.montant, 18000);
});

test("droit d'enregistrement — non confirmé => 0, jamais un taux inventé (échec conservateur)", () => {
  const r = fiscal.calculDroitEnregistrement(50000000, { mode: "a_confirmer", valeur: 0 });
  assert.equal(r.montant, 0);
  assert.equal(r.confirme, false);
});

test("taxe foncière — 1,2% + 3 000 FCFA fixe, exemple réel du cabinet (mainlevée, base 158 200 000)", () => {
  const r = fiscal.calculTaxeFonciere(158200000, PARAMETRES_DEFAUT);
  assert.equal(r.proportionnel, 1898400); // confirmé exact par le document réel
  assert.equal(r.fixe, 3000);
  assert.equal(r.total, 1901400);
});

test("timbres/rôles — 500 FCFA par page, exemple réel du cabinet (minute 4 pages, 2 expéditions de 5 pages, bordereau)", () => {
  const r = fiscal.calculDocumentsPage(
    { pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesTroisiemeDocument: 1 },
    500
  );
  assert.equal(r.minute, 2000); // 4 × 500
  assert.equal(r.expedition, 5000); // 5 × 2 × 500
  assert.equal(r.troisiemeDocument, 500); // 1 × 500 (bordereau d'enregistrement)
  assert.equal(r.total, 7500);
});

test("TVA — 18% sur les honoraires HT", () => {
  assert.equal(fiscal.calculTVA(200000, 0.18), 36000);
});

test("fiche de taxe complète — cohérence des totaux (aucun flottant, total = somme des parties)", () => {
  const typeActe = {
    id: "t1",
    libelle: "Acte de vente avec Titre de propriété",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.04,
    taxeFonciereApplicable: true,
  };
  const fiche = fiscal.calculerFicheDeTaxe(typeActe, 50000000, PARAMETRES_DEFAUT, BAREME_VENTE, {
    timbres: { pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesBordereau: 1 },
    roles: { pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesCopie: 1 },
    vacations: 0,
    fraisFormalites: { depotBanque: 15000, depotEnregistrement: 15000, inscriptionLivreFoncier: 75000, requisitionEtat: 6000 },
  });

  assert.ok(Number.isInteger(fiche.totaux.general), "le total général doit être un entier (francs CFA)");
  assert.equal(
    fiche.totaux.general,
    fiche.totaux.droitsEtat + fiche.totaux.honoraires + fiche.totaux.formalitesEtDivers
  );
});

test("fiche de taxe — acte lié au crédit utilise le barème prêt du Décret 2013-279", () => {
  const typeActe = {
    id: "t2",
    libelle: "Si bien immobilier",
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.015,
    taxeFonciereApplicable: true,
  };
  const fiche = fiscal.calculerFicheDeTaxe(typeActe, 10000000, PARAMETRES_DEFAUT, BAREME_PRET, {});
  assert.equal(fiche.emoluments.montantHT, 200000); // 10 000 000 × 2 % (1ère tranche prêt)
  assert.equal(fiche.droitEnregistrement.montant, 150000); // 10 000 000 × 1,5 %
});
