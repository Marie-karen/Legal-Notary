/**
 * scripts/creer-premier-utilisateur.js — Bootstrap du tout premier compte notaire et son étude.
 *
 * Utilisation interactive (recommandée — saisie masquée du mot de passe) :
 *   DATABASE_URL=postgresql://localhost:5432/legal_notary_dev node scripts/creer-premier-utilisateur.js
 * ou avec arguments :
 *   DATABASE_URL=postgresql://localhost:5432/legal_notary_dev node scripts/creer-premier-utilisateur.js "Me Kouassi Jean" notaire@etude.ci
 *
 * Le mot de passe est demandé de façon interactive avec masquage dans le terminal (*).
 * L'étude associée est automatiquement détectée ou créée si la base est vierge.
 */

require("dotenv").config();
const readline = require("readline");
const { pool } = require("../src/db/pool");
const authService = require("../src/services/auth.service");

function poserQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (reponse) => {
      rl.close();
      resolve(reponse.trim());
    });
  });
}

function demanderMotDePasseMasque(question = "Mot de passe (saisie masquée) : ") {
  return new Promise((resolve) => {
    const isTTY = process.stdin.isTTY;

    if (!isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (rep) => {
        rl.close();
        resolve(rep.trim());
      });
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(question);

    let mdp = "";
    const onData = (data) => {
      const str = data.toString("utf8");
      for (const char of str) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(mdp);
          return;
        } else if (char === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.exit(1);
        } else if (char === "\u0008" || char === "\x7f") {
          if (mdp.length > 0) {
            mdp = mdp.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          mdp += char;
          process.stdout.write("*");
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  let [nomComplet, email, motDePasse] = process.argv.slice(2);

  console.log("\n=======================================================");
  console.log("🏛️  Legal Notary — Initialisation du Premier Compte Notaire");
  console.log("=======================================================\n");

  if (!nomComplet) {
    nomComplet = await poserQuestion("Nom complet du notaire (ex. Me Kouassi Jean) : ");
  }
  if (!nomComplet) {
    console.error("❌ Le nom complet est obligatoire.");
    process.exit(1);
  }

  if (!email) {
    email = await poserQuestion("Adresse email (ex. notaire@etude.ci) : ");
  }
  if (!email || !email.includes("@")) {
    console.error("❌ Une adresse email valide est obligatoire.");
    process.exit(1);
  }

  if (!motDePasse) {
    motDePasse = await demanderMotDePasseMasque("Mot de passe (saisie masquée) : ");
    if (motDePasse.length < 8) {
      console.error("❌ Le mot de passe doit contenir au moins 8 caractères.");
      process.exit(1);
    }
    const confirmation = await demanderMotDePasseMasque("Confirmation du mot de passe : ");
    if (motDePasse !== confirmation) {
      console.error("❌ Les mots de passe saisis ne correspondent pas.");
      process.exit(1);
    }
  }

  // 1. Vérification / Création de l'étude
  let etudeId;
  const { rows: etudesExistantes } = await pool.query(
    "SELECT id, nom_etude FROM etudes ORDER BY created_at ASC LIMIT 1"
  );

  if (etudesExistantes.length > 0) {
    etudeId = etudesExistantes[0].id;
    console.log(`\nℹ️  Étude existante rattachée : ${etudesExistantes[0].nom_etude} (${etudeId})`);
  } else {
    const nomEtude = `Étude ${nomComplet}`;
    const codeEtude = "ETD-DEV-01";
    const { rows: nouvelleEtude } = await pool.query(
      `INSERT INTO etudes (code_etude, nom_etude, titre_notaire, pays, langue, pack_regional, fuseau_horaire, indicatif_tel, devise_code, devise_symbole)
       VALUES ($1, $2, 'Notaire Titulaire', 'ci', 'fr', 'ohada-uemoa', 'Africa/Abidjan', '+225', 'XOF', 'FCFA')
       RETURNING id, nom_etude`,
      [codeEtude, nomEtude]
    );
    etudeId = nouvelleEtude[0].id;
    console.log(`\n✨ Nouvelle étude créée : ${nouvelleEtude[0].nom_etude} (${etudeId})`);
  }

  // 2. Vérification d'existence du compte
  const { rows: existants } = await pool.query("SELECT id FROM utilisateurs WHERE LOWER(TRIM(email)) = $1", [
    email.toLowerCase().trim(),
  ]);

  if (existants.length > 0) {
    console.log(`\nℹ️  Un utilisateur avec l'email '${email}' existe déjà en base.`);
    return;
  }

  // 3. Création du compte notaire
  const utilisateur = await authService.creerUtilisateur({
    nomComplet,
    email,
    motDePasse,
    role: "notaire",
    etudeId,
  });

  console.log("\n=======================================================");
  console.log("✅ Compte notaire initialisé avec succès !");
  console.log(`   - Nom : ${utilisateur.nomComplet}`);
  console.log(`   - Email : ${utilisateur.email}`);
  console.log(`   - Rôle : ${utilisateur.role}`);
  console.log(`   - Étude ID : ${etudeId}`);
  console.log("=======================================================\n");
}

main()
  .then(() => pool.end())
  .catch((erreur) => {
    console.error("\n❌ Erreur lors de la création :", erreur.message || erreur);
    pool.end();
    process.exit(1);
  });
