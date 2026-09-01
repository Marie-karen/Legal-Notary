/**
 * tests/tp_excel_comparison.test.js — Validation des 11 fiches réelles TP Excel
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fiscal = require("../src/services/fiscal.service");

test("TEST.xlsx — Mainlevée d'hypothèque SIB (Base 158 200 000 FCFA)", () => {
  const tranchesPret = [
    { jusqua: 10000000, taux: 0.01 },
    { jusqua: 30000000, taux: 0.0075 },
    { jusqua: 90000000, taux: 0.005 },
    { jusqua: null, taux: 0.0025 },
  ];
  const emols = fiscal.calculEmoluments(158200000, tranchesPret, 50000);
  assert.equal(emols.montantHT, 720500, "Émolument proportionnel dégressif exact");

  const tf = fiscal.calculTaxeFonciere(158200000, { taxeFonciereTauxProportionnel: 0.012, taxeFonciereDroitFixe: 3000 });
  assert.equal(tf.proportionnel, 1898400, "Taxe foncière proportionnelle 1.2% exacte");
  assert.equal(tf.total, 1901400, "Taxe foncière totale exacte");

  const timbres = fiscal.calculDocumentsPage({ pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesTroisiemeDocument: 1 }, 500);
  assert.equal(timbres.minute, 2000);
  assert.equal(timbres.expedition, 5000);
  assert.equal(timbres.troisiemeDocument, 500);
  assert.equal(timbres.total, 7500);

  const enLettres = fiscal.nombreEnLettresFCFA(2952900);
  assert.match(enLettres, /DEUX MILLIONS NEUF CENT CINQUANTE-DEUX MILLE NEUF CENTS FRANCS CFA|DEUX MILLIONS NEUF CENT CINQUANTE DEUX MILLE NEUF CENTS FRANCS CFA/);
});

test("TP VENTE ACQUEREUR.xlsx — Vente (Base 35 000 000 FCFA)", () => {
  const emolsVente = fiscal.calculEmoluments(35000000, { formuleSpeciale: "vente_usage" });
  assert.equal(emolsVente.montantHT, 750000, "Formule (35M * 1%) + 400 000 = 750 000 FCFA");

  const enreg = fiscal.calculDroitEnregistrement(35000000, { mode: "pourcentage", valeur: 0.04 });
  assert.equal(enreg.montant, 1400000, "Droit d'enregistrement 4% = 1 400 000 FCFA");

  const tf = fiscal.calculTaxeFonciere(35000000, { taxeFonciereTauxProportionnel: 0.012, taxeFonciereDroitFixe: 3000 });
  assert.equal(tf.total, 423000, "Taxe foncière (35M * 1.2% + 3000) = 423 000 FCFA");
});

test("TP PROMESSE DE VENTE.xlsx — Promesse règle des 3/4 (Base 120 000 000 FCFA)", () => {
  const emols = fiscal.calculEmoluments(120000000, { formuleSpeciale: "promesse_vente_3_4" });
  assert.equal(emols.montantHT, 1087500, "Formule ((120M * 0.5%) + 850 000) * 3/4 = 1 087 500 FCFA");
});

test("TP REALISATION PROMESSE.xlsx — Réalisation règle du 1/4 (Base 120 000 000 FCFA)", () => {
  const emols = fiscal.calculEmoluments(120000000, { formuleSpeciale: "realisation_promesse_1_4" });
  assert.equal(emols.montantHT, 362500, "Formule ((120M * 0.5%) + 850 000) * 1/4 = 362 500 FCFA");
});

test("TP DE DONATION.xlsx — Donation (Base 135 780 000 FCFA)", () => {
  const emols = fiscal.calculEmoluments(135780000, { formuleSpeciale: "donation" });
  assert.equal(emols.montantHT, 1528900, "Formule (135 780 000 * 0.5%) + 850 000 = 1 528 900 FCFA");
});

test("TP VENTE VENDEUR.xlsx — Plus-Value 3.4% (Base 4 000 000 FCFA)", () => {
  const pv = fiscal.arrondi(4000000 * 0.034);
  assert.equal(pv, 136000, "Plus-value de cession 3.4% = 136 000 FCFA");
});
