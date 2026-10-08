const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const fiscalRoutes = require("../src/api/fiscal.routes");
const campagnesService = require("../src/services/campagnes-numerisation.service");

test("Vérification non-régression lint C0 — campagnes-numerisation.service ne plante plus sans 'pool'", async () => {
  // Test listerCampagnes
  const campagnes = await campagnesService.listerCampagnes("a0000000-0000-0000-0000-000000000001");
  assert.ok(Array.isArray(campagnes), "Doit retourner une liste de campagnes");
  assert.ok(campagnes.length >= 0, "La liste de campagnes doit être itérable");

  // Test creerCampagne
  const nouvelleCampagne = await campagnesService.creerCampagne({
    intitule: "Campagne Test C0 Non-Regression",
    anneeDebut: 2021,
    anneeFin: 2025,
    totalDossiers: 500,
  });
  assert.ok(nouvelleCampagne, "La création de campagne doit renvoyer un objet");
  assert.ok(nouvelleCampagne.code_campagne || nouvelleCampagne.codeCampagne, "Doit comporter un code campagne valide");

  // Test enregistrerAvancementLot
  const campagneId = nouvelleCampagne.id;
  const avancement = await campagnesService.enregistrerAvancementLot({
    campagneId,
    nombreNumerisesAjoutes: 10,
    nombreEnCours: 5,
  });
  assert.ok(avancement, "L'enregistrement de l'avancement doit renvoyer un résultat valide");
});

test("Vérification non-régression lint C0 — route /modeles-excel/telecharger/:id ne plante plus sans 'fs' et 'path'", async () => {
  const app = express();
  app.use("/api/fiscal", fiscalRoutes);

  // Créer un serveur HTTP temporaire
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    // 1. Appel avec un fichier modèle existant : vérifie fs.existsSync, path.basename et fs.createReadStream
    const dossierModelesPerso = path.resolve(__dirname, "../data/modeles_excel");
    if (!fs.existsSync(dossierModelesPerso)) {
      fs.mkdirSync(dossierModelesPerso, { recursive: true });
    }
    const fichierTest = path.join(dossierModelesPerso, "test_c0_modele.xlsx");
    fs.writeFileSync(fichierTest, "CONTENU_FICTIF_EXCEL_TEST");

    try {
      const resExistant = await fetch(
        `http://127.0.0.1:${port}/api/fiscal/modeles-excel/telecharger/perso_test_c0_modele.xlsx`
      );
      assert.equal(resExistant.status, 200, "Doit répondre 200 pour un fichier modèle existant");
      assert.ok(
        resExistant.headers.get("content-disposition")?.includes("test_c0_modele.xlsx"),
        "Content-Disposition doit contenir le basename extrait par 'path'"
      );
      const texteRecu = await resExistant.text();
      assert.equal(texteRecu, "CONTENU_FICTIF_EXCEL_TEST", "Le stream 'fs' doit transférer le contenu");
    } finally {
      if (fs.existsSync(fichierTest)) {
        fs.unlinkSync(fichierTest);
      }
    }

    // 2. Appel avec chemin introuvable : vérifie la branche 404 et fs.existsSync
    const excelService = require("../src/services/excel.service");
    const originalObtenirChemin = excelService.obtenirCheminModele;
    try {
      excelService.obtenirCheminModele = () => "/chemin/absolument/introuvable/inexistant.xlsx";
      const resIntrouvable = await fetch(`http://127.0.0.1:${port}/api/fiscal/modeles-excel/telecharger/inexistant`);
      assert.equal(resIntrouvable.status, 404, "Doit répondre 404 sans planter");
      const jsonIntrouvable = await resIntrouvable.json();
      assert.deepEqual(jsonIntrouvable, { erreur: "Fichier modèle introuvable." });
    } finally {
      excelService.obtenirCheminModele = originalObtenirChemin;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
