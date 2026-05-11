-- Bloque 11: Metadata documental en checkpoints
-- Ejecutar en: Supabase Dashboard → SQL Editor

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS doc_state     TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS object_type   TEXT DEFAULT 'checkpoint',
  ADD COLUMN IF NOT EXISTS sensitivity   TEXT DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS version_label TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS responsible   TEXT,
  ADD COLUMN IF NOT EXISTS doc_metadata  JSONB DEFAULT '{}';
