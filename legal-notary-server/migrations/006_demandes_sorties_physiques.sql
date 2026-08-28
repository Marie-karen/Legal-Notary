-- Migration 006 : Demandes de sorties physiques, approbation archiviste / assistante et suivi des retards

ALTER TABLE mouvements_dossiers_physiques DROP CONSTRAINT IF EXISTS mouvements_dossiers_physiques_statut_check;
ALTER TABLE mouvements_dossiers_physiques ADD CONSTRAINT mouvements_dossiers_physiques_statut_check 
CHECK (statut IN ('en_attente_approbation', 'en_cours', 'retourne', 'en_retard', 'rejete'));

ALTER TABLE mouvements_dossiers_physiques ADD COLUMN IF NOT EXISTS date_sortie date DEFAULT CURRENT_DATE;
ALTER TABLE mouvements_dossiers_physiques ADD COLUMN IF NOT EXISTS approuve_par_id uuid REFERENCES utilisateurs(id);
ALTER TABLE mouvements_dossiers_physiques ADD COLUMN IF NOT EXISTS date_approbation timestamptz;
