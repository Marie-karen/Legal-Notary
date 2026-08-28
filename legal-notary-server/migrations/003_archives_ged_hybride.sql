-- migrations/003_archives_ged_hybride.sql
--
-- Architecture complète du sous-module « Minutier & Archives / Archivage » :
-- 1. Isolation multi-études (tenant `etude_id`).
-- 2. Modélisation du Jumeau Numérique (Original Papier + Copie Numérique).
-- 3. Gestion hiérarchique des emplacements physiques (Site > Salle > Armoire > Rayon > Boîte > Position).
-- 4. Traçabilité des mouvements physiques (Sorties / Emprunts / Retours / Bureaux).
-- 5. Campagnes de numérisation historiques (1995-2025).
-- 6. File d'attente de synchronisation hybride (Sync Engine).
-- 7. Télémétrie de monitoring & support L1-L4 avec accès temporaire audité.

-- ---------------------------------------------------------------------
-- 1. Table des Études (Multi-tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_etude text NOT NULL UNIQUE,
  nom_etude text NOT NULL,
  titre_notaire text NOT NULL DEFAULT 'Notaire Titulaire',
  mode_infrastructure text NOT NULL DEFAULT 'hybride' CHECK (mode_infrastructure IN ('local', 'cloud', 'hybride')),
  domaine text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insertion de l'étude par défaut si inexistante
INSERT INTO etudes (id, code_etude, nom_etude, titre_notaire, mode_infrastructure)
VALUES ('a0000000-0000-0000-0000-000000000001', 'ETUDE-PRINCIPALE', 'Office Notarial — Legal Notary', 'Notaire Titulaire', 'hybride')
ON CONFLICT (code_etude) DO NOTHING;

-- Ajout de etude_id aux tables existantes si absent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parametres_etude' AND column_name = 'etude_id') THEN
    ALTER TABLE parametres_etude ADD COLUMN etude_id uuid REFERENCES etudes(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'utilisateurs' AND column_name = 'etude_id') THEN
    ALTER TABLE utilisateurs ADD COLUMN etude_id uuid REFERENCES etudes(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'etude_id') THEN
    ALTER TABLE dossiers ADD COLUMN etude_id uuid REFERENCES etudes(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cartons_archive' AND column_name = 'etude_id') THEN
    ALTER TABLE cartons_archive ADD COLUMN etude_id uuid REFERENCES etudes(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'minutes_archive' AND column_name = 'etude_id') THEN
    ALTER TABLE minutes_archive ADD COLUMN etude_id uuid REFERENCES etudes(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  -- Ajout du statut de numérisation sur les dossiers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'statut_numerisation') THEN
    ALTER TABLE dossiers ADD COLUMN statut_numerisation text NOT NULL DEFAULT 'NON_NUMERISE'
      CHECK (statut_numerisation IN (
        'NON_NUMERISE', 'EN_PREPARATION', 'EN_COURS_NUMERISATION',
        'OCR_EN_COURS', 'CONTROLE_QUALITE', 'NUMERISATION_PARTIELLE',
        'NUMERISE', 'NUMERISE_ET_VALIDE'
      ));
  END IF;

  -- Enrichissement des cartons d'archive
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cartons_archive' AND column_name = 'annee_periode') THEN
    ALTER TABLE cartons_archive
      ADD COLUMN annee_periode text DEFAULT '',
      ADD COLUMN type_dossiers text DEFAULT 'Tous actes',
      ADD COLUMN batiment text DEFAULT 'Bâtiment Principal',
      ADD COLUMN zone text DEFAULT 'Zone A',
      ADD COLUMN etagere text DEFAULT 'Étagère 1';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Emplacements Physiques Hiérarchiques
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emplacements_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  site text NOT NULL DEFAULT 'Étude Principale',
  batiment text NOT NULL DEFAULT 'Bâtiment Principal',
  salle text NOT NULL DEFAULT 'Salle des Archives',
  zone text NOT NULL DEFAULT 'Zone A',
  rayonnage text NOT NULL DEFAULT 'Rayon 1',
  etagere text NOT NULL DEFAULT 'Étagère 1',
  armoire text NOT NULL DEFAULT 'Armoire 1',
  description text NOT NULL DEFAULT '',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. Jumeaux Numériques : Documents Numériques (GED & Scans OCR)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents_numeriques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_document text NOT NULL, -- '01_identification', '02_pieces_clients', '03_propriete', '04_fiscalite', '05_actes_minute', '06_correspondance', '07_plans', '08_annexes', '09_divers'
  nom_fichier text NOT NULL,
  chemin_stockage text NOT NULL,
  taille_octets bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  version integer NOT NULL DEFAULT 1,
  hash_sha256 text NOT NULL,
  statut_ocr text NOT NULL DEFAULT 'traite' CHECK (statut_ocr IN ('en_attente', 'en_cours', 'traite', 'echec', 'non_applicable')),
  texte_ocr text DEFAULT '',
  statut_validation text NOT NULL DEFAULT 'valide' CHECK (statut_validation IN ('a_valider', 'valide', 'rejete')),
  est_copie_minute_officielle boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  cree_par_id uuid REFERENCES utilisateurs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_doc_num_dossier ON documents_numeriques (dossier_id);
CREATE INDEX IF NOT EXISTS idx_doc_num_hash ON documents_numeriques (hash_sha256);

-- ---------------------------------------------------------------------
-- 4. Documents Physiques & Originaux Papiers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents_physiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  titre_document text NOT NULL,
  statut_physique text NOT NULL DEFAULT 'archive' CHECK (statut_physique IN ('en_cours_etude', 'archive', 'sorti_consultation', 'transfere', 'detruit_legalement')),
  carton_id uuid REFERENCES cartons_archive(id),
  position_carton integer,
  est_numerisable boolean NOT NULL DEFAULT true,
  raison_non_numerisable text DEFAULT '', -- ex: "Plan cadastral grand format plié / Papier calque fragile / Sceau de cire"
  notes_conservation text DEFAULT '',
  localisation_actuelle text DEFAULT '', -- bureau si sorti, ou code carton si archivé
  cree_par_id uuid REFERENCES utilisateurs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_phys_dossier ON documents_physiques (dossier_id);
CREATE INDEX IF NOT EXISTS idx_doc_phys_carton ON documents_physiques (carton_id);

-- ---------------------------------------------------------------------
-- 5. Mouvements des Dossiers Physiques (Sorties & Retours)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mouvements_dossiers_physiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_mouvement text NOT NULL CHECK (type_mouvement IN ('sortie_consultation', 'retour_carton', 'transfert_bureau', 'versement_initial')),
  utilisateur_id uuid REFERENCES utilisateurs(id),
  nom_demandeur text NOT NULL,
  motif text NOT NULL,
  destination_bureau text NOT NULL, -- ex: "Bureau Notaire Maître X", "Bureau Clerc Rédacteur 2"
  emplacement_origine text NOT NULL DEFAULT '',
  emplacement_destination text NOT NULL DEFAULT '',
  date_mouvement timestamptz NOT NULL DEFAULT now(),
  date_retour_prevue date,
  date_retour_effective timestamptz,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'retourne', 'en_retard')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mouv_phys_dossier ON mouvements_dossiers_physiques (dossier_id, date_mouvement DESC);
CREATE INDEX IF NOT EXISTS idx_mouv_phys_statut ON mouvements_dossiers_physiques (statut);

-- ---------------------------------------------------------------------
-- 6. Campagnes de Numérisation (Archives Historiques)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campagnes_numerisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  code_campagne text NOT NULL UNIQUE, -- ex: "CAMP-2026-001"
  intitule text NOT NULL,
  annee_debut integer NOT NULL,
  annee_fin integer NOT NULL,
  type_actes_cibles text NOT NULL DEFAULT 'Tous actes',
  total_dossiers integer NOT NULL DEFAULT 0,
  dossiers_numerises integer NOT NULL DEFAULT 0,
  dossiers_en_cours integer NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('planifiee', 'en_cours', 'suspendue', 'terminee')),
  responsable_id uuid REFERENCES utilisateurs(id),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. Sync Engine (File d'attente de Synchronisation Hybride)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS file_synchronisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  entite_type text NOT NULL, -- 'dossier', 'document_numerique', 'minute', 'mouvement_physique'
  entite_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync_file')),
  charge_utile jsonb NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'synchronise', 'echec', 'conflit')),
  tentatives integer NOT NULL DEFAULT 0,
  derniere_erreur text,
  hash_integrite text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_statut ON file_synchronisation (statut, created_at ASC);

-- ---------------------------------------------------------------------
-- 8. Télémétrie & Monitoring de l'Instance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instances_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL UNIQUE REFERENCES etudes(id) ON DELETE CASCADE,
  mode_infrastructure text NOT NULL DEFAULT 'hybride',
  statut_app text NOT NULL DEFAULT 'operationnel', -- 'operationnel', 'degrade', 'erreur'
  statut_db text NOT NULL DEFAULT 'operationnel',
  statut_stockage text NOT NULL DEFAULT 'operationnel',
  statut_sync text NOT NULL DEFAULT 'operationnel',
  statut_backup text NOT NULL DEFAULT 'operationnel',
  espace_stockage_utilise_mo bigint NOT NULL DEFAULT 1240,
  espace_stockage_total_mo bigint NOT NULL DEFAULT 50000,
  elements_en_attente_sync integer NOT NULL DEFAULT 0,
  derniere_synchro timestamptz DEFAULT now(),
  dernier_backup timestamptz DEFAULT now(),
  version_app text NOT NULL DEFAULT '2.4.0',
  ip_locale text DEFAULT '192.168.1.100',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insertion de la ligne de monitoring pour l'étude par défaut
INSERT INTO instances_monitoring (etude_id, mode_infrastructure)
VALUES ('a0000000-0000-0000-0000-000000000001', 'hybride')
ON CONFLICT (etude_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9. Portail Support L1-L4 & Accès Temporaire Audité
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id uuid NOT NULL REFERENCES etudes(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001',
  numero_ticket text NOT NULL UNIQUE, -- ex: "TICK-2026-0089"
  utilisateur_id uuid REFERENCES utilisateurs(id),
  titre text NOT NULL,
  description text NOT NULL,
  niveau text NOT NULL DEFAULT 'L1' CHECK (niveau IN ('L1', 'L2', 'L3', 'L4')),
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'en_attente_etude', 'resolu', 'ferme')),
  priorite text NOT NULL DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'critique')),
  diagnostic_snapshot jsonb NOT NULL DEFAULT '{}',
  acces_donnees_accorde boolean NOT NULL DEFAULT false,
  motif_acces text DEFAULT '',
  expiration_acces timestamptz,
  intervenant_support text DEFAULT '',
  reponse_support text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
