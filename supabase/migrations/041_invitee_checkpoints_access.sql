-- Migration 041: Allow Connected Teams invitee to access checkpoints in isolated workspaces
-- Date: 2026-06-26
-- Description: Extend checkpoints and checkpoint_messages RLS to allow invitee (receiver)
--              of active connections to read and insert checkpoints/messages in the shared
--              isolated workspace. Host policies remain unchanged.

-- ── checkpoints ──────────────────────────────────────────────────────────────

-- Policy: Invitee can read checkpoints in isolated workspace
DROP POLICY IF EXISTS "Invitee can read checkpoints in isolated workspace" ON public.checkpoints;

CREATE POLICY "Invitee can read checkpoints in isolated workspace"
  ON public.checkpoints FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE w.id = checkpoints.workspace_id
        AND tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );

-- Policy: Invitee can insert checkpoints in isolated workspace
DROP POLICY IF EXISTS "Invitee can insert checkpoints in isolated workspace" ON public.checkpoints;

CREATE POLICY "Invitee can insert checkpoints in isolated workspace"
  ON public.checkpoints FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE w.id = checkpoints.workspace_id
        AND tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );

-- ── checkpoint_messages ───────────────────────────────────────────────────────

-- Policy: Invitee can read checkpoint_messages in isolated workspace
DROP POLICY IF EXISTS "Invitee can read checkpoint_messages in isolated workspace" ON public.checkpoint_messages;

CREATE POLICY "Invitee can read checkpoint_messages in isolated workspace"
  ON public.checkpoint_messages FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.checkpoints c
      JOIN public.workspaces w
        ON w.id = c.workspace_id
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE c.id = checkpoint_messages.checkpoint_id
        AND tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
        AND (
          -- Agent messages: access derived from checkpoint/workspace/team/connection
          (
            checkpoint_messages.message_type = 'agent'
            AND checkpoint_messages.session_id IS NOT NULL
          )
          OR
          -- Human messages: must also match the exact connection_id
          (
            checkpoint_messages.message_type = 'human'
            AND checkpoint_messages.connection_id = tc.id
          )
        )
    )
  );

-- Policy: Invitee can insert checkpoint_messages in isolated workspace
DROP POLICY IF EXISTS "Invitee can insert checkpoint_messages in isolated workspace" ON public.checkpoint_messages;

CREATE POLICY "Invitee can insert checkpoint_messages in isolated workspace"
  ON public.checkpoint_messages FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checkpoints c
      JOIN public.workspaces w
        ON w.id = c.workspace_id
      JOIN public.team_connections tc
        ON tc.scope_isolated_team_id = w.team_id
      WHERE c.id = checkpoint_messages.checkpoint_id
        AND tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
        AND (
          -- Agent messages: access derived from checkpoint/workspace/team/connection
          (
            checkpoint_messages.message_type = 'agent'
            AND checkpoint_messages.session_id IS NOT NULL
          )
          OR
          -- Human messages: must also match the exact connection_id
          (
            checkpoint_messages.message_type = 'human'
            AND checkpoint_messages.connection_id = tc.id
          )
        )
    )
  );

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON POLICY "Invitee can read checkpoints in isolated workspace" ON public.checkpoints IS
  'Allows invitee (receiver) of an active Connected Teams connection to read checkpoints
   from the shared isolated workspace.';

COMMENT ON POLICY "Invitee can insert checkpoints in isolated workspace" ON public.checkpoints IS
  'Allows invitee (receiver) of an active Connected Teams connection to create checkpoints
   in the shared isolated workspace.';

COMMENT ON POLICY "Invitee can read checkpoint_messages in isolated workspace" ON public.checkpoint_messages IS
  'Allows invitee (receiver) of an active Connected Teams connection to read checkpoint_messages
   from checkpoints in the shared isolated workspace. For human message type, also verifies
   the message belongs to the exact connection_id to prevent cross-connection leakage.';

COMMENT ON POLICY "Invitee can insert checkpoint_messages in isolated workspace" ON public.checkpoint_messages IS
  'Allows invitee (receiver) of an active Connected Teams connection to insert checkpoint_messages
   into checkpoints in the shared isolated workspace. For human message type, also verifies
   the message belongs to the exact connection_id to prevent cross-connection leakage.';
