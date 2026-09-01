-- =====================================================================
-- 007_fiches_taxe_validation_workflow.sql
-- Circuit de validation officielle des Fiches de Taxe (Comptable <-> Notaire)
-- =====================================================================

ALTER TABLE fiches_taxe
  ADD COLUMN IF NOT EXISTS statut VARCHAR(30) NOT NULL DEFAULT 'valide',
  ADD COLUMN IF NOT EXISTS commentaire_notaire TEXT,
  ADD COLUMN IF NOT EXISTS valide_par_id UUID REFERENCES utilisateurs(id),
  ADD COLUMN IF NOT EXISTS valide_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS modifications_notaire JSONB;

CREATE INDEX IF NOT EXISTS idx_fiches_taxe_statut ON fiches_taxe (statut, created_at DESC);
