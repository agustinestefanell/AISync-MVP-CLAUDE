-- Migration 046: Allow status='deleted' in context_sources
-- Applied manually in Supabase SQL Editor: 2026-07-02
-- This file documents the schema change already applied in production

ALTER TABLE context_sources DROP CONSTRAINT context_sources_status_check;

ALTER TABLE context_sources ADD CONSTRAINT context_sources_status_check
  CHECK (status IN ('active', 'archived', 'deleted'));

COMMENT ON CONSTRAINT context_sources_status_check ON context_sources IS
'Allows active (available for AI), archived (soft-removed), and deleted (Storage object removed, metadata preserved for traceability).';
