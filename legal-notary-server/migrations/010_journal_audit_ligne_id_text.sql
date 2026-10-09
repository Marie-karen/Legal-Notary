-- =====================================================================
-- Migration 010 — Typage de ligne_id en text dans journal_audit
-- Permet de consigner de manière stricte et sans valeur nulle les
-- identifiants d'entités non-UUID (ex: baremes_emoluments, types_actes,
-- taches_standard, parametres_etude).
-- =====================================================================

ALTER TABLE journal_audit ALTER COLUMN ligne_id TYPE text USING ligne_id::text;
