const { pool } = require("../src/db/pool");

async function seedRapports() {
  const users = await pool.query("SELECT id, nom_complet, role FROM utilisateurs WHERE role IN ('commercial', 'support', 'dev', 'assistante_editeur')");
  const userMap = {};
  users.rows.forEach((u) => {
    userMap[u.role] = u;
  });

  const commercialUser = userMap["commercial"] || { id: null, nom_complet: "Alexandre Commercial" };
  const supportUser = userMap["support"] || { id: null, nom_complet: "Sara Support" };
  const devUser = userMap["dev"] || { id: null, nom_complet: "Kevin DevOps" };

  await pool.query("DELETE FROM rapports_activite_saas");

  // 1. Rapport Commercial
  await pool.query(
    `INSERT INTO rapports_activite_saas
     (auteur_id, auteur_nom, role, titre, periode_debut, periode_fin, statut, donnees, en_retard, date_soumission)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      commercialUser.id,
      commercialUser.nom_complet,
      "commercial",
      "Rapport Hebdomadaire Commercial & Démos · Semaine 34",
      "2026-08-18",
      "2026-08-22",
      "valide_direction",
      JSON.stringify({
        etudesContactees: 14,
        demosRealisees: 6,
        contratsSignes: 2,
        mrrGenereFCFA: 500000,
        etudesEnClosing: ["Étude Me Touré (Plateau)", "Étude Me Kouamé (Yopougon)", "Étude Me Diabaté (Cocody)"],
        faitsMarquants: "Très fort intérêt pour la simulation fiscale Décret 2013 et la numérisation des cartons d'archives. 2 contrats signés avec paiement annuel anticipé.",
        pointsBloquants: "Besoin d'un guide PDF pas-à-pas pour rassurer les assistantes d'accueil.",
        prioritesSemaineProchaine: "Finaliser l'onboarding de Me Touré et démarrer la prospection sur la zone de San Pedro."
      }),
      false,
      "2026-08-22 16:30:00"
    ]
  );

  // 2. Rapport Support
  await pool.query(
    `INSERT INTO rapports_activite_saas
     (auteur_id, auteur_nom, role, titre, periode_debut, periode_fin, statut, donnees, en_retard, date_soumission)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      supportUser.id,
      supportUser.nom_complet,
      "support",
      "Rapport Hebdomadaire Support Client & CSAT · Semaine 34",
      "2026-08-18",
      "2026-08-22",
      "soumis",
      JSON.stringify({
        ticketsTraites: 38,
        ticketsResolus: 36,
        scoreCsatPct: 98.2,
        tempsReponseMinutes: 12,
        topProblemes: "1. Paramétrage scanner réseau · 2. Question sur émoluments mixtes · 3. Réinitialisation mot de passe clerc.",
        etudesSousSurveillance: "Étude Me Bamba (formation prévue lundi 10h pour le nouveau clerc formaliste).",
        recommandations: "Créer une courte vidéo de 2 minutes sur l'enregistrement des sorties de cartons physiques."
      }),
      false,
      "2026-08-22 17:15:00"
    ]
  );

  // 3. Rapport Dev
  await pool.query(
    `INSERT INTO rapports_activite_saas
     (auteur_id, auteur_nom, role, titre, periode_debut, periode_fin, statut, donnees, en_retard, date_soumission)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      devUser.id,
      devUser.nom_complet,
      "dev",
      "Rapport Hebdomadaire Technique, Sauvegardes & Infra · Semaine 34",
      "2026-08-18",
      "2026-08-22",
      "valide_direction",
      JSON.stringify({
        uptimePourcentage: 99.98,
        incidentsBloquants: 0,
        snapshotsWormGeneres: 7,
        testPraConformite: "100% OK",
        misesEnProduction: "Mise en ligne de la protection anti-brute-force et du renforcement des en-têtes HTTP de sécurité.",
        prioritesTechniques: "Surveillance continue de la télémétrie et optimisation des index PostgreSQL pour le fonds ancien 1995-2025."
      }),
      false,
      "2026-08-22 15:45:00"
    ]
  );

  console.log("✅ Rapports SaaS de démonstration insérés avec succès !");
  pool.end();
}

seedRapports().catch((err) => {
  console.error(err);
  pool.end();
});
