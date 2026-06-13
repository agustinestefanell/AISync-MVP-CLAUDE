-- Migración 029: scope_isolated_workspace_id en team_connections
-- Fecha: 2026-06-13
-- Propósito: Persistir workspace_id del isolated team directamente para evitar
--            join cross-account bloqueado por RLS cuando el invitado accede a la conexión

ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS scope_isolated_workspace_id uuid
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_connections.scope_isolated_workspace_id IS
  'Direct reference to the shared workspace created for this connection. Populated when isolated team is created. Prevents RLS-blocked cross-account joins for receiver access.';
