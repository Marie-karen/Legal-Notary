const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../src/db/pool");
const kycService = require("../src/services/kyc.service");

test("KYC Service — Cycle de vie complet Fiche KYC & Signature Client", async (t) => {
  // 1. Récupérer un dossier existant ou en créer un pour le test
  let dossierRes = await pool.query(
    "SELECT id, numero_dossier FROM dossiers LIMIT 1",
  );
  if (!dossierRes.rows || dossierRes.rows.length === 0) {
    const etudeRes = await pool.query(
      `INSERT INTO etudes (nom_etude, code_etude)
       VALUES ('Etude Test KYC', 'ETD-TEST-KYC')
       ON CONFLICT (code_etude) DO UPDATE SET nom_etude = EXCLUDED.nom_etude
       RETURNING id`,
    );
    const etudeId = etudeRes.rows[0].id;
    const typeActeRes = await pool.query("SELECT id FROM types_actes LIMIT 1");
    let typeActeId = typeActeRes.rows[0]?.id;
    if (!typeActeId) {
      const tRes = await pool.query(
        "INSERT INTO types_actes (libelle) VALUES ('Vente Immobilière Test') RETURNING id",
      );
      typeActeId = tRes.rows[0].id;
    }
    await pool.query(
      `INSERT INTO dossiers (etude_id, numero_dossier, type_acte_id, annee_ouverture, statut)
       VALUES ($1, 'DOS-TEST-KYC-001', $2, 2026, 'actif')`,
      [etudeId, typeActeId],
    );
    dossierRes = await pool.query(
      "SELECT id, numero_dossier FROM dossiers WHERE numero_dossier = 'DOS-TEST-KYC-001'",
    );
  }
  assert.ok(dossierRes.rows.length > 0, "Un dossier doit exister en base");
  const dossier = dossierRes.rows[0];

  // 2. Générer ou récupérer un token KYC
  const tokenData = await kycService.genererOuRecupererTokenKyc(dossier.id);
  assert.ok(tokenData.token, "Un token sécurisé doit être généré");
  assert.equal(tokenData.dossierId, dossier.id);
  assert.ok(
    tokenData.statut === "en_attente" ||
      tokenData.statut === "renseigne" ||
      tokenData.statut === "valide",
  );

  // 3. Obtenir le formulaire public avec le token (simulation du client smartphone)
  const formPublic = await kycService.obtenirFormulaireKycPublic(
    tokenData.token,
  );
  assert.equal(formPublic.token, tokenData.token);
  assert.equal(formPublic.dossier.id, dossier.id);
  assert.ok(formPublic.etude.nomEtude);

  // 4. Soumettre le formulaire avec signature client tactile
  const signatureSimulee =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const payloadSoumission = {
    typePersonne: "physique",
    signeA: "Abidjan Plateau",
    signature: signatureSimulee,
    donnees: {
      nomPrenoms: "KOUAME JEAN-BAPTISTE",
      nomJeuneFille: "",
      nomPere: "KOUAME KOUADIO",
      nomMere: "AMENAN KAN",
      dateNaissance: "1985-04-12",
      lieuNaissance: "Bouaké",
      statutMatrimonial: "marie",
      nationalite: "Ivoirienne",
      pieceIdentite: "CNI CI0012345678",
      compteContribuable: "2104589X",
      adresseGeographique: "Cocody Riviera Golf, Abidjan",
      telephone: "+225 07 08 09 10 11",
      profession: "Ingénieur Télécoms",
      employeur: "Orange Côte d'Ivoire",
      secteurActivite: "Télécommunications",
      estPPE: "non",
      origineFonds: "De votre activité",
      provenanceCI: "OUI",
      anciennetePro: "De 1 à 10 ans",
      signeA: "Abidjan Plateau",
      dateSignature: new Date().toISOString(),
    },
  };

  const resultatSoumission = await kycService.soumettreKycClient(
    tokenData.token,
    payloadSoumission,
    "127.0.0.1",
    "Test-Browser/1.0",
  );
  assert.equal(resultatSoumission.statut, "renseigne");
  assert.equal(resultatSoumission.signe_a, "Abidjan Plateau");
  assert.equal(resultatSoumission.signature_client, signatureSimulee);

  // 5. Consulter la fiche KYC côté office
  const kycDossier = await kycService.obtenirKycDossier(dossier.id);
  assert.ok(kycDossier);
  assert.equal(kycDossier.statut, "renseigne");
  assert.equal(kycDossier.donnees.nomPrenoms, "KOUAME JEAN-BAPTISTE");
  assert.equal(kycDossier.donnees.nationalite, "Ivoirienne");

  // 6. Validation par le notaire
  const validation = await kycService.validerKycDossier(dossier.id, null);
  assert.equal(validation.statut, "valide");
  assert.ok(validation.valide_le);
});
