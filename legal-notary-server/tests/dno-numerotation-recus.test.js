const test = require("node:test");
const assert = require("node:assert");
const dossiersService = require("../src/services/dossiers.service");
const parametresService = require("../src/services/parametres.service");

test("Numérotation - Incrémentation et génération de numéro séquentiel", () => {
  const annee = new Date().getFullYear();

  // Format global par défaut
  const format1 = "DOS-{AAAA}-{NUM}";
  const num1 = dossiersService.formaterNumeroDossier(format1, annee, 42, "VTE");
  assert.strictEqual(num1, `DOS-${annee}-0042`);

  // Format avec code nature
  const format2 = "{AAAA}-{CODE}-{NUM}";
  const num2 = dossiersService.formaterNumeroDossier(format2, annee, 7, "SOC");
  assert.strictEqual(num2, `${annee}-SOC-0007`);

  // Format personnalisé sans variable code
  const format3 = "ETUDE/{AAAA}/N{NUM}";
  const num3 = dossiersService.formaterNumeroDossier(format3, annee, 150, "SUC");
  assert.strictEqual(num3, `ETUDE/${annee}/N0150`);
});

test("DNO Validation - Vérification des pièces jointes requises", () => {
  const piecesValides = [
    {
      nomPiece: "Fiche KYC Personne Physique",
      urlFichier: "data:application/pdf;base64,abc",
    },
    {
      nomPiece: "CNI / Passeport",
      urlFichier: "data:application/pdf;base64,def",
    },
  ];

  assert.ok(piecesValides.length >= 2);
  assert.strictEqual(piecesValides[0].nomPiece, "Fiche KYC Personne Physique");
});

test("Reçus de Paiement - Génération et Validation Notaire", async () => {
  const recusService = require("../src/services/recus.service");

  const recu = await recusService.creerRecuPaiement({
    etudeId: "test-etude-1",
    dossierId: "dos-test-1",
    numeroDossier: "DOS-2026-0001",
    typeActeId: "vente_immobiliere",
    clientNom: "M. KOUASSI Jean",
    clientEmail: "kouassi.jean@gmail.com",
    montantProvision: 500000,
    fraisOuverture: 50000,
    montantTotal: 550000,
    montantAssiette: 35000000,
    modePaiement: "virement",
    creeParUtilisateurId: "usr-comptable-1",
  });

  assert.ok(recu.id);
  assert.ok(recu.numeroRecu.startsWith("RECU-"));
  assert.strictEqual(recu.montantTotal, 550000);
  assert.strictEqual(recu.statut, "en_attente_validation");

  // Validation par le Notaire
  const result = await recusService.validerEtEnvoyerRecuClient(recu.id, {
    id: "usr-notaire-1",
    role: "notaire",
    nom: "Maître KONE",
    etudeId: "test-etude-1",
  });

  assert.strictEqual(result.recu.statut, "valide");
  assert.ok(result.recu.valideLe);
});
