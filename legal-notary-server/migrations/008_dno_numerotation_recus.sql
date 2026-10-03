-- migrations/008_dno_numerotation_recus.sql
--
-- Migration pour le circuit DNO (Dossier Non Ouvert), Numérotation Paramétrable & Reçus Comptables.

-- 1. Paramètres de l'étude : Continuité de la numérotation et confidentialité financière
ALTER TABLE parametres_etude
  ADD COLUMN IF NOT EXISTS mode_numerotation VARCHAR(30) DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS format_numerotation VARCHAR(100) DEFAULT 'DOS-{AAAA}-{NUM}',
  ADD COLUMN IF NOT EXISTS dernier_numero_global INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS derniers_numeros_par_nature JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS premier_clerc_voir_finances BOOLEAN DEFAULT false;

-- 2. Dossiers : Support DNO, statut de paiement provision, pièces scannées, type personne
ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS type_creation VARCHAR(30) DEFAULT 'dossier_ouvert',
  ADD COLUMN IF NOT EXISTS numero_dno VARCHAR(50),
  ADD COLUMN IF NOT EXISTS statut_dno VARCHAR(30) DEFAULT 'ouvert',
  ADD COLUMN IF NOT EXISTS type_personne VARCHAR(20) DEFAULT 'physique',
  ADD COLUMN IF NOT EXISTS pieces_jointes_dno JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frais_ouverture BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provision_versee BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode_paiement_provision VARCHAR(50),
  ADD COLUMN IF NOT EXISTS date_paiement_provision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comptable_validateur_id UUID REFERENCES utilisateurs(id),
  ADD COLUMN IF NOT EXISTS email_client VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telephone_client VARCHAR(50);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_dossiers_statut_dno ON dossiers (statut_dno);
CREATE INDEX IF NOT EXISTS idx_dossiers_numero_dno ON dossiers (numero_dno);

-- 3. Table des reçus de paiement générés par le comptable
CREATE TABLE IF NOT EXISTS recus_paiement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id UUID,
  numero_recu VARCHAR(50) NOT NULL UNIQUE,
  dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
  client_nom VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_telephone VARCHAR(50),
  montant_total BIGINT NOT NULL,
  frais_ouverture BIGINT NOT NULL DEFAULT 0,
  provision BIGINT NOT NULL DEFAULT 0,
  montant_assiette BIGINT DEFAULT 0,
  mode_paiement VARCHAR(50) NOT NULL,
  statut VARCHAR(30) NOT NULL DEFAULT 'en_attente_validation' CHECK (statut IN ('en_attente_validation', 'valide', 'rejete')),
  cree_par_id UUID REFERENCES utilisateurs(id),
  valide_par_id UUID REFERENCES utilisateurs(id),
  valide_le TIMESTAMPTZ,
  envoye_au_client_le TIMESTAMPTZ,
  recu_scanne_url TEXT,
  recu_scanne_nom TEXT,
  recu_scanne_le TIMESTAMPTZ,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recus_dossier ON recus_paiement (dossier_id);
CREATE INDEX IF NOT EXISTS idx_recus_etude ON recus_paiement (etude_id);
CREATE INDEX IF NOT EXISTS idx_recus_statut ON recus_paiement (statut);
