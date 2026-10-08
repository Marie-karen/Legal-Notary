/**
 * tests/excel.service.test.js — Tests unitaires de la suite Excel d'étude (.xlsx).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const excelService = require("../src/services/excel.service");

test("excelService — listerModelesExcel inclut TEST.xlsx par défaut", () => {
  const modeles = excelService.listerModelesExcel();
  assert.ok(Array.isArray(modeles));
  const testMod = modeles.find((m) => m.id === "TEST");
  assert.ok(testMod, "Le modèle TEST.xlsx doit être listé");
  assert.strictEqual(testMod.parDefaut, true);
});

test("excelService — genererFichierExcelLiquidation remplit TEST.xlsx fidèlement", () => {
  const dossier = {
    numeroDossier: "2026-TEST-001",
    clientNom: "SOCIETE CIVILE IMMOBILIERE LES HIBISCUS",
    comparantsNoms: "SCI LES HIBISCUS",
    montantAssiette: 158200000,
    typeActeLibelle: "Mainlevée d'hypothèque SIB",
  };

  const fiche = {
    totaux: {
      emolumentsHT: 720500,
      tresor: 1919400,
      debours: 110000,
      general: 2749900,
    },
    emoluments: {
      montantHT: 720500,
      totalEmolumentsHT: 720500,
    },
    lignesTresor: [
      { code: "dgi_fixe", montant: 18000 },
      { code: "taxe_fonciere_fixe", montant: 3000 },
    ],
    saisies: {
      timbres: { pagesMinute: 4, nombreExpeditions: 2, pagesExpedition: 5 },
    },
  };

  const params = {
    nomEtude: "Étude de Maître Ginette OKOUE-KODJO",
    nomNotaire: "Ginette OKOUE-KODJO",
    titreNotaire: "Maître",
  };

  const buffer = excelService.genererFichierExcelLiquidation(dossier, fiche, params, "TEST");
  assert.ok(buffer && buffer.length > 0, "Le buffer Excel généré ne doit pas être vide");

  const wb = XLSX.read(buffer, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("BASE"));
  assert.ok(wb.SheetNames.includes("FICHE DE TAXE"));
  assert.ok(wb.SheetNames.includes("NOTE DE FRAIS"));
  assert.ok(wb.SheetNames.includes("FACTURE NORMALISE"));

  const base = wb.Sheets["BASE"];
  assert.strictEqual(base["C2"].v, 158200000);
  assert.strictEqual(base["F9"].v, "SCI LES HIBISCUS");
});
