require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("../src/db/pool");

async function seedDemoUsers() {
  const hash = await bcrypt.hash("notaire123", 10);
  const hashDemo = await bcrypt.hash("demo123", 10);

  const users = [
    { nom: "Maître Démo (Accès Total)", email: "demo@notaire.ci", hash: hashDemo, role: "notaire", sal: 1500000 },
    { nom: "Maître Titulaire", email: "notaire@notaire.ci", hash: hash, role: "notaire", sal: 1200000 },
    { nom: "Premier Clerc", email: "premier.clerc@notaire.ci", hash: hash, role: "premier_clerc", sal: 650000 },
    { nom: "Clerc Rédacteur", email: "clerc1@notaire.ci", hash: hash, role: "clerc_redacteur", sal: 450000 },
    { nom: "Clerc aux Formalités", email: "formalites@notaire.ci", hash: hash, role: "clerc_formaliste", sal: 400000 },
    { nom: "Comptable Taxateur", email: "comptable@notaire.ci", hash: hash, role: "comptable_taxateur", sal: 500000 },
    { nom: "Assistante Accueil", email: "accueil@notaire.ci", hash: hash, role: "assistante", sal: 300000 },
  ];

  for (const u of users) {
    const existing = await pool.query("SELECT id FROM utilisateurs WHERE email = $1", [u.email.toLowerCase()]);
    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE utilisateurs SET mot_de_passe_hash = $1, role = $2, actif = true, archived_at = NULL WHERE id = $3",
        [u.hash, u.role, existing.rows[0].id]
      );
      console.log("[demo] Compte existant mis a jour :", u.email);
    } else {
      await pool.query(
        "INSERT INTO utilisateurs (nom_complet, email, mot_de_passe_hash, role, telephone, date_embauche, type_contrat, salaire_net) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [u.nom, u.email.toLowerCase(), u.hash, u.role, "+225 07 00 00 00 00", "2023-01-01", "CDI", u.sal]
      );
      console.log("[demo] Compte cree :", u.email);
    }
  }

  console.log("Tous les comptes demo sont prets !");
}

seedDemoUsers()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
