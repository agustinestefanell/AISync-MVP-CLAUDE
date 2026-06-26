-- Connected Teams: Two separate managers per connection (host + invitee)
-- Etapa 1 of 8-stage correction plan (see DECISIONS.md 2026-06-26)
--
-- Adds two new columns to support correct architecture:
-- - host_isolated_team_id: points to Host's own Manager team/workspace
-- - invitee_isolated_team_id: points to Invitee's own Manager team/workspace
--
-- scope_isolated_team_id (legacy shared manager) remains untouched until Etapa 8.
-- Both new columns are nullable to support gradual migration (Etapas 2-7).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Add host_isolated_team_id to team_connections
ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS host_isolated_team_id uuid
  REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add invitee_isolated_team_id to team_connections
ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS invitee_isolated_team_id uuid
  REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_connections.host_isolated_team_id IS
  'Points to Host (requester) isolated team/workspace with own Manager. Part of two-manager architecture (see DECISIONS.md 2026-06-26).';

COMMENT ON COLUMN public.team_connections.invitee_isolated_team_id IS
  'Points to Invitee (receiver) isolated team/workspace with own Manager. Part of two-manager architecture (see DECISIONS.md 2026-06-26).';

COMMENT ON COLUMN public.team_connections.scope_isolated_team_id IS
  'LEGACY: Shared manager (incorrect architecture). Maintained for backward compatibility during Etapas 2-7. Candidate for removal in Etapa 8.';
