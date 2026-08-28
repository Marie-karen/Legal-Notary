const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

async function run() {
  console.log("=== Exécution de la migration 003_archives_ged_hybride.sql ===");
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/003_archives_ged_hybride.sql'), 'utf-8');
  await pool.query(sql);

  // Garantir le DEFAULT sur les tables déjà créées
  const tables = [
    'emplacements_archives', 'documents_numeriques', 'documents_physiques',
    'mouvements_dossiers_physiques', 'campagnes_numerisation', 'file_synchronisation',
    'tickets_support'
  ];
  for (const t of tables) {
    await pool.query(`ALTER TABLE ${t} ALTER COLUMN etude_id SET DEFAULT 'a0000000-0000-0000-0000-000000000001'`);
  }

  console.log("✅ Migration 003 exécutée avec succès.");

  // Vérifier et insérer quelques données de démonstration pour les campagnes et mouvements si vides
  const { rows: camps } = await pool.query("SELECT COUNT(*)::int AS n FROM campagnes_numerisation");
  if (camps[0].n === 0) {
    console.log("🌱 Insertion d'une campagne de numérisation de démonstration...");
    await pool.query(`
      INSERT INTO campagnes_numerisation (etude_id, code_campagne, intitule, annee_debut, annee_fin, type_actes_cibles, total_dossiers, dossiers_numerises, dossiers_en_cours, statut, notes)
      VALUES
        ('a0000000-0000-0000-0000-000000000001', 'CAMP-2026-001', 'Fonds Ancien Ventes & Titres Fonciers (2010 - 2015)', 2010, 2015, 'Ventes & Mutations ACD', 12450, 8420, 1230, 'en_cours', 'Campagne prioritaire de numérisation haute définition 300 DPI avec OCR.'),
        ('a0000000-0000-0000-0000-000000000001', 'CAMP-2026-002', 'Fonds Ancien Prêts & Hypothèques (2016 - 2020)', 2016, 2020, 'Prêts hypothécaires & Quittances', 6800, 5100, 700, 'en_cours', 'Indexation des conventions de crédit et états réquisition.')
    `);
  }

  // Vérifier et insérer un emplacement physique de référence
  const { rows: empls } = await pool.query("SELECT COUNT(*)::int AS n FROM emplacements_archives");
  if (empls[0].n === 0) {
    console.log("🌱 Insertion des emplacements physiques de démonstration...");
    await pool.query(`
      INSERT INTO emplacements_archives (etude_id, site, batiment, salle, zone, rayonnage, etagere, armoire, description)
      VALUES
        ('a0000000-0000-0000-0000-000000000001', 'Étude Principale', 'Bâtiment A', 'Salle des Archives 1', 'Zone A - Minutes', 'Rayon R01', 'Étagère E01', 'Armoire 01', 'Conservation des minutes de ventes'),
        ('a0000000-0000-0000-0000-000000000001', 'Étude Principale', 'Bâtiment A', 'Salle des Archives 1', 'Zone B - Prêts', 'Rayon R02', 'Étagère E02', 'Armoire 02', 'Conservation des actes de prêt'),
        ('a0000000-0000-0000-0000-000000000001', 'Étude Principale', 'Bâtiment B', 'Salle des Archives 2', 'Zone Plans Grands Formats', 'Rayon R04', 'Étagère E03', 'Armoire 04', 'Conservation des plans cadastraux et rouleaux physiques non numérisables')
    `);
  }

  console.log("✅ Données initiales d'archives prêtes.");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Erreur lors de l'exécution de la migration:", err);
  process.exit(1);
});
