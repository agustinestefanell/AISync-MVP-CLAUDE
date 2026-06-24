-- Migration 040: Allow Connected Teams invitee to access messages in isolated workspaces
-- Date: 2026-06-24
-- Description: Extend messages RLS to allow invitee (receiver) of active connections
--              to read and insert messages in agent sessions of the shared isolated workspace.
--              Host policies remain unchanged.

-- Policy: Invitee can read messages in isolated workspace
DROP POLICY IF EXISTS "Invitee can read messages in isolated workspace" ON public.messages;

CREATE POLICY "Invitee can read messages in isolated workspace"
  ON public.messages FOR SELECT USING (
    session_id IN (
      SELECT ags.id
      FROM public.agent_sessions ags
      JOIN public.workspaces w ON w.id = ags.workspace_id
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );

-- Policy: Invitee can insert messages in isolated workspace
DROP POLICY IF EXISTS "Invitee can insert messages in isolated workspace" ON public.messages;

CREATE POLICY "Invitee can insert messages in isolated workspace"
  ON public.messages FOR INSERT WITH CHECK (
    session_id IN (
      SELECT ags.id
      FROM public.agent_sessions ags
      JOIN public.workspaces w ON w.id = ags.workspace_id
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );

-- Comments
COMMENT ON POLICY "Invitee can read messages in isolated workspace" ON public.messages IS
  'Allows invitee (receiver) of an active Connected Teams connection to read messages
   from agent sessions in the shared isolated workspace.';

COMMENT ON POLICY "Invitee can insert messages in isolated workspace" ON public.messages IS
  'Allows invitee (receiver) of an active Connected Teams connection to insert messages
   into agent sessions in the shared isolated workspace.';
