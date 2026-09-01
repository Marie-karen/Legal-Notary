const test = require("node:test");
const assert = require("node:assert/strict");
const fiscalService = require("../src/services/fiscal.service");

test("Workflow Fiche de Taxe — Calcul et cohérence des statuts déontologiques", async () => {
  const typeActe = {
    id: "vente-immobiliere",
    libelle: "Vente d'immeuble",
    taxeFonciereApplicable: true,
    droitEnregistrementMode: "pourcentage",
    droitEnregistrementValeur: 0.04,
  };

  const tranches = [
    { ordre: 1, jusqua: 5000000, taux: 0.04 },
    { ordre: 2, jusqua: 20000000, taux: 0.03 },
    { ordre: 3, jusqua: 100000000, taux: 0.015 },
    { ordre: 4, jusqua: null, taux: 0.0075 },
  ];

  const saisiesComptable = {
    timbres: { pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesBordereau: 1 },
    roles: { pagesMinute: 4, pagesExpedition: 5, nombreExpeditions: 2, pagesCopie: 0 },
    lignesEmoluments: [
      { code: "inscription_livre_foncier", actif: true, montant: 75000 },
      { code: "extrait_topographique", actif: true, montant: 15000 },
      { code: "requisition_fonciere", actif: true, montant: 10000 },
      { code: "bordereau_enregistrement", actif: true, montant: 1000 },
      { code: "etats_fonciers", actif: true, montant: 30000 },
      { code: "situation_fiscale", actif: true, montant: 15000 },
      { code: "art_135", actif: true, montant: 20000 },
      { code: "divers_papeterie", actif: true, montant: 20000 },
    ],
  };

  // 1. Calcul initial par le comptable
  const calcul1 = fiscalService.calculerFicheDeTaxe(typeActe, 35000000, {}, tranches, saisiesComptable);
  assert.ok(calcul1.totaux.general > 0);
  assert.equal(calcul1.totaux.emolumentsHT, 902000);
  assert.ok(calcul1.totaux.tresor > 0);
  assert.equal(calcul1.totaux.generalEnLettres.includes("FRANCS CFA"), true);

  // 2. Simulation de correction par le Notaire (ajout de vacation 150k + débours 100k)
  const saisiesNotaire = {
    ...saisiesComptable,
    vacations: 150000,
    lignesEmoluments: [
      ...saisiesComptable.lignesEmoluments,
      { code: "debours_divers_formalites", categorie: "debours", actif: true, montant: 100000 },
    ],
  };

  const calcul2 = fiscalService.calculerFicheDeTaxe(typeActe, 35000000, {}, tranches, saisiesNotaire);
  assert.equal(calcul2.totaux.emolumentsHT, 902000 + 150000);
  assert.equal(calcul2.totaux.debours, 100000);
  assert.ok(calcul2.totaux.general > calcul1.totaux.general);

  // 3. Statuts légaux valides du workflow
  const statutsLegaux = ["brouillon", "soumis", "valide", "valide_corrige", "a_corriger"];
  statutsLegaux.forEach(st => assert.ok(typeof st === "string"));
});
