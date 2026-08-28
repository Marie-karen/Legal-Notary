const { pool } = require("./pool");

async function initTelemetrie() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemetrie_erreurs_parc (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      etude_id UUID REFERENCES etudes(id) ON DELETE SET NULL,
      nom_etude TEXT,
      source TEXT NOT NULL,
      type_erreur TEXT NOT NULL,
      message TEXT NOT NULL,
      stack_trace TEXT,
      niveau TEXT NOT NULL DEFAULT 'error',
      meta JSONB DEFAULT '{}'::jsonb,
      statut TEXT NOT NULL DEFAULT 'nouveau',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS noeuds_heartbeat_parc (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      etude_id UUID REFERENCES etudes(id) ON DELETE CASCADE,
      nom_noeud TEXT NOT NULL,
      pair_token TEXT,
      ip_locale TEXT,
      cpu_pct NUMERIC(5,2) DEFAULT 0,
      ram_pct NUMERIC(5,2) DEFAULT 0,
      disque_pct NUMERIC(5,2) DEFAULT 0,
      version_agent TEXT,
      derniere_activite TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      statut TEXT DEFAULT 'en_ligne'
    );
  `);
  console.log("✅ Tables telemetrie_erreurs_parc et noeuds_heartbeat_parc initialisées avec succès.");
}

if (require.main === module) {
  initTelemetrie()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { initTelemetrie };
