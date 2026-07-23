-- Migration 050: Add project binding columns to team_connections
-- Connect Team active Project binding OE
-- 2026-07-22
--
-- Adds two columns to bind each side of a connection to their active Project:
-- - requester_project_id: Host's active Project at request time
-- - receiver_project_id: Invitee's active Project at accept time
--
-- These replace the automatic creation of dedicated Projects for each connection.
-- Legacy accepted connections keep their existing dedicated Projects (no migration/backfill).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Add requester_project_id to team_connections
ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS requester_project_id uuid
  REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add receiver_project_id to team_connections
ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS receiver_project_id uuid
  REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_connections_requester_project_id
  ON public.team_connections(requester_project_id);

CREATE INDEX IF NOT EXISTS idx_team_connections_receiver_project_id
  ON public.team_connections(receiver_project_id);

-- Comments for documentation
COMMENT ON COLUMN public.team_connections.requester_project_id IS
  'Host (requester) active Project at request time. Isolated team created for Host will use this project_id. NULL for legacy connections created before this migration.';

COMMENT ON COLUMN public.team_connections.receiver_project_id IS
  'Invitee (receiver) active Project at accept time. Isolated team created for Invitee will use this project_id. NULL for legacy pending connections or legacy accepted connections.';
