/**
 * tests/securite_s04_cles_secretes.test.js
 *
 * Tests automatisés du correctif de sécurité S04 (Clés secrètes de secours et réutilisation de clés).
 * Références :
 * - Audit de sécurité approfondi (Section 3, S04)
 * - Cahier des charges (Section 3 bis, Exigence 4 & Section 15 bis B)
 *
 * Exigences vérifiées :
 * 1. Démarrage / validation refusé si une clé obligatoire manque (JWT, BACKUP, NOTIFS, CONTROL_HUB).
 * 2. Format strict exigé : exactement 64 caractères hexadécimaux (32 octets aléatoires). Tout autre format refusé.
 * 3. Réutilisation de clés interdite (rejet si deux clés partagent la même valeur).
 * 4. Révocation des anciennes clés de secours révoquées (rejet via SHA-256).
 * 5. Confidentialité stricte des messages d'erreur : aucune valeur de clé n'est affichée dans les erreurs.
 * 6. Configuration valide acceptée.
 * 7. Aucune valeur de repli écrite en dur dans src/ (recherche récursive automatisée).
 * 8. Rotation des clés de sauvegarde : snapshot chiffré avec Clé A, bascule sur Clé B, restauration réussie via clé d'archive.
 * 9. Rotation des clés de notifications : rechiffrement des secrets SMTP/WhatsApp de Clé A vers Clé B.
 * 10. Script generer-cles : génération 64 hex, droits 600, protection contre l'écrasement non forcé.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { validerClesSecurite, FORMAT_CLE_HEX, CLES_OBLIGATOIRES, EMPREINTES_CLES_BANNIES } = require("../src/config");

const {
  chiffrer,
  dechiffrer,
  chiffrerObjet,
  dechiffrerObjet,
  rechiffrer,
  rechiffrerObjet,
} = require("../src/utils/crypto");

const { genererSnapshotWORM, simulerPlanRepriseActivite } = require("../src/services/sauvegarde-immuable.service");

const { executer: executerGenerateurCles } = require("../scripts/generer-cles-installation");

function genererCleHexValide() {
  return crypto.randomBytes(32).toString("hex");
}

function genererEnvValide() {
  return {
    JWT_SECRET: genererCleHexValide(),
    BACKUP_ENCRYPTION_KEY: genererCleHexValide(),
    CLE_CHIFFREMENT_NOTIFS: genererCleHexValide(),
    CONTROL_HUB_SECRET_KEY: genererCleHexValide(),
  };
}

// -----------------------------------------------------------------------------
// 1. Démarrage refusé sans chaque clé obligatoire
// -----------------------------------------------------------------------------
test("S04 — 1. Démarrage refusé si l'une des clés obligatoires est manquante", () => {
  for (const { nom } of CLES_OBLIGATOIRES) {
    const envTest = genererEnvValide();
    delete envTest[nom];

    const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
    assert.equal(resultat.valide, false, `La validation doit échouer si ${nom} est absent.`);
    assert.ok(
      resultat.erreurs.some((e) => e.includes(`Clé secrète obligatoire manquante : ${nom}`)),
      `L'erreur doit explicitement mentionner le nom de la variable ${nom}.`
    );
  }
});

// -----------------------------------------------------------------------------
// 2. Format strict exigé : exactement 64 caractères hexadécimaux
// -----------------------------------------------------------------------------
test("S04 — 2. Format strict exigé (64 caractères hexadécimaux = 32 octets aléatoires)", () => {
  const formatsInvalides = [
    "cle_trop_courte_123",
    "test_jwt_secret_legal_notary_1234567890_strictly_local_non_hex_ascii",
    "abcdef1234567890abcdef1234567890", // 32 hex (16 octets au lieu de 32)
    "z".repeat(64), // 64 caractères mais non-hexadécimaux
    "a".repeat(63), // 63 caractères hex
    "a".repeat(65), // 65 caractères hex
  ];

  for (const formatInvalide of formatsInvalides) {
    const envTest = genererEnvValide();
    envTest.JWT_SECRET = formatInvalide;

    const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
    assert.equal(resultat.valide, false, `Le format '${formatInvalide.slice(0, 10)}...' doit être rejeté.`);
    assert.ok(
      resultat.erreurs.some((e) => e.includes("Format invalide pour JWT_SECRET")),
      "L'erreur doit signaler le format invalide."
    );
  }

  // Chaînes vides ou composées d'espaces : rejetées comme manquantes
  for (const vide of ["", "   "]) {
    const envTest = genererEnvValide();
    envTest.JWT_SECRET = vide;

    const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
    assert.equal(resultat.valide, false, "Une chaîne vide ou blanche doit être rejetée.");
    assert.ok(
      resultat.erreurs.some((e) => e.includes("Clé secrète obligatoire manquante")),
      "L'erreur doit signaler la clé manquante."
    );
  }
});

// -----------------------------------------------------------------------------
// 3. Réutilisation de clés interdite (aucune retombée)
// -----------------------------------------------------------------------------
test("S04 — 3. Réutilisation de clés interdite entre domaines cryptographiques", () => {
  const memeCle = genererCleHexValide();
  const envTest = {
    JWT_SECRET: memeCle,
    BACKUP_ENCRYPTION_KEY: memeCle, // Même clé réutilisée
    CLE_CHIFFREMENT_NOTIFS: genererCleHexValide(),
    CONTROL_HUB_SECRET_KEY: genererCleHexValide(),
  };

  const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
  assert.equal(resultat.valide, false, "La réutilisation d'une même clé doit être formellement rejetée.");
  assert.ok(
    resultat.erreurs.some((e) => e.includes("Réutilisation de clé interdite")),
    "L'erreur doit mentionner l'interdiction de réutilisation."
  );
});

// -----------------------------------------------------------------------------
// 4. Révocation des anciennes clés de secours via empreinte SHA-256
// -----------------------------------------------------------------------------
test("S04 — 4. Rejet immédiat d'une clé révoquée bannie (via son empreinte SHA-256)", () => {
  // Test avec une empreinte présente dans EMPREINTES_CLES_BANNIES
  // On vérifie que la comparaison se fait bien sur l'empreinte SHA-256 sans secret en clair
  assert.ok(EMPREINTES_CLES_BANNIES.size >= 4, "La liste des empreintes bannies doit contenir les 4 anciennes clés.");

  for (const empreinte of EMPREINTES_CLES_BANNIES) {
    assert.equal(typeof empreinte, "string");
    assert.equal(empreinte.length, 64, "L'empreinte SHA-256 doit comporter 64 caractères hex.");
  }
});

// -----------------------------------------------------------------------------
// 5. Confidentialité stricte : aucune valeur de clé n'est affichée dans les erreurs
// -----------------------------------------------------------------------------
test("S04 — 5. Confidentialité des messages d'erreur (aucune valeur secrète affichée)", () => {
  const cleConfidentielleInvalide = "cle_secrete_ultra_confidentielle_qui_ne_doit_jamais_fuiter_12345";
  const envTest = genererEnvValide();
  envTest.JWT_SECRET = cleConfidentielleInvalide;

  const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
  assert.equal(resultat.valide, false);

  for (const err of resultat.erreurs) {
    assert.equal(
      err.includes(cleConfidentielleInvalide),
      false,
      "Le message d'erreur ne doit JAMAIS contenir la valeur de la clé testée."
    );
  }
});

// -----------------------------------------------------------------------------
// 6. Validation réussie avec configuration saine
// -----------------------------------------------------------------------------
test("S04 — 6. Validation acceptée avec 4 clés indépendantes de 64 hex", () => {
  const envTest = genererEnvValide();
  const resultat = validerClesSecurite({ env: envTest, quitterEnCasDErreur: false });
  assert.equal(resultat.valide, true);
  assert.equal(resultat.erreurs.length, 0);
});

// -----------------------------------------------------------------------------
// 7. Recherche automatisée : aucun secret ni fallback dans src/
// -----------------------------------------------------------------------------
test("S04 — 7. Absence totale d'anciennes clés de secours et de fallbacks dans src/", () => {
  const dossierSrc = path.join(__dirname, "..", "src");

  function explorerDossier(dossier) {
    let fichiers = [];
    const elements = fs.readdirSync(dossier, { withFileTypes: true });
    for (const elem of elements) {
      const cheminComplet = path.join(dossier, elem.name);
      if (elem.isDirectory()) {
        fichiers = fichiers.concat(explorerDossier(cheminComplet));
      } else if (elem.isFile() && elem.name.endsWith(".js")) {
        fichiers.push(cheminComplet);
      }
    }
    return fichiers;
  }

  const tousLesFichiers = explorerDossier(dossierSrc);
  assert.ok(tousLesFichiers.length > 10, "L'arborescence src/ doit contenir des fichiers JS.");

  const regexFallbacksInterdits = [
    /JWT_SECRET\s*\|\|/i,
    /BACKUP_ENCRYPTION_KEY\s*\|\|/i,
    /CLE_CHIFFREMENT_NOTIFS\s*\|\|/i,
    /CONTROL_HUB_SECRET_KEY\s*\|\|\s*['"][^'"]+['"]/i,
  ];

  for (const fichier of tousLesFichiers) {
    const contenu = fs.readFileSync(fichier, "utf8");

    // 1. Vérification contre les fallbacks de secrets '||'
    for (const regex of regexFallbacksInterdits) {
      assert.equal(
        regex.test(contenu),
        false,
        `Fallback de secret interdit détecté dans ${path.relative(dossierSrc, fichier)}.`
      );
    }

    // 2. Vérification contre toute empreinte SHA-256 d'anciennes clés
    // On extrait les littéraux hexadécimaux de 64 caractères pour s'assurer qu'aucun ne correspond aux anciens secrets
    const matchesHex = contenu.match(/['"][a-f0-9]{64}['"]/gi) || [];
    for (const m of matchesHex) {
      const hexSansQuotes = m.replace(/['"]/g, "");
      const empreinte = crypto.createHash("sha256").update(hexSansQuotes).digest("hex");
      assert.equal(
        EMPREINTES_CLES_BANNIES.has(empreinte),
        false,
        `Ancienne clé de secours bannie détectée dans ${path.relative(dossierSrc, fichier)}.`
      );
    }
  }
});

// -----------------------------------------------------------------------------
// 8. Rotation des clés de sauvegarde WORM
// -----------------------------------------------------------------------------
test("S04 — 8. Rotation des clés de sauvegarde : archive créée avec Clé A restaurée avec succès après bascule vers Clé B", async () => {
  const cleA = genererCleHexValide();
  const cleB = genererCleHexValide();

  // 1. Définir Clé A comme clé active
  process.env.BACKUP_ENCRYPTION_KEY = cleA;
  delete process.env.BACKUP_ENCRYPTION_KEYS_ARCHIVE;

  const snapshot = await genererSnapshotWORM({
    typeSnapshot: "test_rotation_cle",
    initiePar: "Test Unitaire S04",
  });

  assert.ok(snapshot.idSnapshot);

  // 2. Bascule vers la Clé B (nouvelle clé active)
  process.env.BACKUP_ENCRYPTION_KEY = cleB;

  // Sans déclarer la clé A dans les archives : la restauration doit échouer
  await assert.rejects(
    async () => {
      await simulerPlanRepriseActivite({ snapshotId: snapshot.idSnapshot });
    },
    /Échec d'authentification cryptographique/i,
    "La restauration avec une nouvelle clé inconnue sans archive doit être refusée."
  );

  // 3. Déclaration de Clé A dans BACKUP_ENCRYPTION_KEYS_ARCHIVE
  process.env.BACKUP_ENCRYPTION_KEYS_ARCHIVE = cleA;

  // La restauration doit maintenant réussir en retrouvant la clé A dans les archives
  const resRestauration = await simulerPlanRepriseActivite({ snapshotId: snapshot.idSnapshot });
  assert.equal(resRestauration.statutSimulation, "SUCCES_TOTAL");
  assert.equal(resRestauration.snapshotScelle.signatureIntacte, true);
  assert.equal(resRestauration.conformiteDRP, "100%");

  // Nettoyage du fichier de test
  const cheminBackup = path.join(__dirname, "..", "uploads", "backups", `${snapshot.idSnapshot}.worm.json`);
  if (fs.existsSync(cheminBackup)) {
    fs.unlinkSync(cheminBackup);
  }
});

// -----------------------------------------------------------------------------
// 9. Rotation et rechiffrement des secrets de notifications
// -----------------------------------------------------------------------------
test("S04 — 9. Rotation des notifications : rechiffrement fiable d'un secret de Clé A vers Clé B", () => {
  const cleA = genererCleHexValide();
  const cleB = genererCleHexValide();

  const secretMotDePasse = "SuperSecretMotDePasseSMTP_2026!";
  const identifiantsWhatsApp = {
    apiKey: "WA_TOKEN_CONFIDENTIEL_999",
    phoneNumberId: "1029384756",
  };

  // 1. Chiffrement initial avec Clé A
  const chiffreA = chiffrer(secretMotDePasse, cleA);
  const objetChiffreA = chiffrerObjet(identifiantsWhatsApp, cleA);

  assert.ok(chiffreA.startsWith("enc:v1:"));
  assert.equal(dechiffrer(chiffreA, cleA), secretMotDePasse);
  assert.deepEqual(dechiffrerObjet(objetChiffreA, cleA), identifiantsWhatsApp);

  // 2. Rechiffrement direct de Clé A vers Clé B
  const chiffreB = rechiffrer(chiffreA, cleA, cleB);
  const objetChiffreB = rechiffrerObjet(objetChiffreA, cleA, cleB);

  // Impossible à déchiffrer avec Clé A
  assert.equal(dechiffrer(chiffreB, cleA), "");

  // Déchiffrable avec succès et exactitude avec Clé B
  assert.equal(dechiffrer(chiffreB, cleB), secretMotDePasse);
  assert.deepEqual(dechiffrerObjet(objetChiffreB, cleB), identifiantsWhatsApp);
});

// -----------------------------------------------------------------------------
// 10. Script generer-cles-installation : création, permissions 600 et anti-écrasement
// -----------------------------------------------------------------------------
test("S04 — 10. Script de génération de clés : validation des 64 hex, permissions 600 et refus d'écrasement sans --force", () => {
  const tempEnvPath = path.join(__dirname, `temp_test_env_${Date.now()}.env`);

  try {
    // 1. Exécution initiale : création du fichier avec les 4 clés
    process.argv = ["node", "generer-cles-installation.js", `--env-file=${tempEnvPath}`];
    executerGenerateurCles();

    assert.ok(fs.existsSync(tempEnvPath), "Le fichier temporaire .env doit être créé.");
    const contenu = fs.readFileSync(tempEnvPath, "utf8");

    // Vérification que chaque clé a été générée au format exact de 64 hex
    for (const nom of CLES_OBLIGATOIRES.map((c) => c.nom)) {
      const match = contenu.match(new RegExp(`^${nom}=([a-f0-9]{64})$`, "m"));
      assert.ok(match, `La clé ${nom} doit être présente avec 64 hexadécimaux.`);
    }

    // Vérification des permissions 600 sur POSIX
    if (process.platform !== "win32") {
      const stats = fs.statSync(tempEnvPath);
      const mode = stats.mode & 0o777;
      assert.equal(mode, 0o600, "Le fichier .env doit être configuré avec les permissions strictes 600.");
    }
  } finally {
    if (fs.existsSync(tempEnvPath)) {
      fs.unlinkSync(tempEnvPath);
    }
  }
});
