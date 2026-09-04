-- migrations/005_fiche_kyc_notariale.sql
-- Table de gestion des Fiches KYC Notariales (Personnes Physiques & Morales)
-- Conforme à la Loi n°2024-363 du 11 juin 2024 et Ordonnance 895 (LBC/FT/FP)

CREATE TABLE IF NOT EXISTS dossier_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  token_acces VARCHAR(64) UNIQUE NOT NULL,
  statut VARCHAR(32) NOT NULL DEFAULT 'en_attente', -- 'en_attente', 'renseigne', 'valide'
  type_personne VARCHAR(32) NOT NULL DEFAULT 'physique', -- 'physique', 'morale', 'association', 'indivision'
  
  -- Données détaillées du questionnaire KYC (Personne Physique / Mandataire / PPE / Origine des fonds)
  donnees_kyc JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Signature tactile du client (image Base64 PNG/SVG)
  signature_client TEXT,
  signe_le TIMESTAMP WITH TIME ZONE,
  signe_a VARCHAR(128) DEFAULT 'Abidjan',
  
  -- Métadonnées de session
  ip_client VARCHAR(64),
  user_agent_client TEXT,
  
  cree_par UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  valide_par UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  valide_le TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dossier_kyc_dossier_id ON dossier_kyc(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_kyc_token ON dossier_kyc(token_acces);
