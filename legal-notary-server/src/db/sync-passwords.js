const { pool } = require("./pool");
const bcrypt = require("bcryptjs");

async function syncPasswords() {
  const hashNotaire = await bcrypt.hash("notaire123", 10);
  const hashAdmin = await bcrypt.hash("admin123", 10);

  // Mettre à jour tous les comptes notariaux
  await pool.query(
    "UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE role NOT IN ('superadmin', 'dev', 'commercial', 'support', 'assistante_editeur')",
    [hashNotaire]
  );

  // Mettre à jour tous les comptes éditeur SaaS
  await pool.query(
    "UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE role IN ('superadmin', 'dev', 'commercial', 'support', 'assistante_editeur')",
    [hashAdmin]
  );

  console.log("✅ Tous les mots de passe des comptes sont synchronisés.");
}

if (require.main === module) {
  syncPasswords()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { syncPasswords };
