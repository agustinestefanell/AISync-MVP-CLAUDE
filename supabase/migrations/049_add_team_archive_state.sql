-- Migration 049: Add archived state columns to teams table
-- Archived Teams OE 1 - Fase 1A: Estado estructural y contrato base
-- 2026-07-15

-- Add status column with constraint
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE teams
  ADD CONSTRAINT teams_status_check
  CHECK (status IN ('active', 'archived'));

-- Add archive metadata columns
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Comments for documentation
COMMENT ON COLUMN teams.status IS
'Team lifecycle status: active or archived. Source of truth for archived state (not tags).';

COMMENT ON COLUMN teams.archived_at IS
'Timestamp when the team was archived. NULL for active teams.';

COMMENT ON COLUMN teams.archived_by IS
'UUID of the account who archived the team. NULL for active teams or if archiving account was deleted. FK to accounts(id) with ON DELETE SET NULL to preserve team history even if account is removed.';

COMMENT ON COLUMN teams.archive_reason IS
'Optional free-text reason provided by user when archiving. NULL if not provided.';
