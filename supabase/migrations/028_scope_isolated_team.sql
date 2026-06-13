-- Scope Isolated Team foundation for Connected Teams Shared Workspace.
-- OE A of 3. Creates support for team type 'isolated' and links active connections to isolated teams.
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. Extend teams.type constraint to support 'isolated'
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_type_check;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_type_check
  CHECK (type IN ('SAT', 'MAT', 'isolated'));

-- 2. Add scope_isolated_team_id to team_connections
ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS scope_isolated_team_id uuid
  REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. RLS policy: invitee can read isolated workspace
DROP POLICY IF EXISTS "Invitee can read isolated workspace" ON public.workspaces;

CREATE POLICY "Invitee can read isolated workspace"
  ON public.workspaces FOR SELECT
  USING (
    team_id IN (
      SELECT scope_isolated_team_id
      FROM public.team_connections
      WHERE receiver_account_id = auth.uid()
        AND status = 'active'
        AND scope_isolated_team_id IS NOT NULL
    )
  );

-- 4. RLS policy: invitee can read isolated team's agent_sessions
DROP POLICY IF EXISTS "Invitee can read isolated agent_sessions" ON public.agent_sessions;

CREATE POLICY "Invitee can read isolated agent_sessions"
  ON public.agent_sessions FOR SELECT
  USING (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.team_connections tc ON tc.scope_isolated_team_id = w.team_id
      WHERE tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );
