-- Fix checkpoint_messages SELECT RLS ownership guard
-- Applied manually to Supabase production on 2026-06-04
-- The live policy was missing auth.uid() filter — only structural JOINs existed.
-- Correct ownership chain: checkpoint_messages → checkpoints → workspaces → teams → projects → auth.uid()

DROP POLICY IF EXISTS checkpoint_messages_select ON checkpoint_messages;

CREATE POLICY checkpoint_messages_select ON checkpoint_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN workspaces w ON w.id = c.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE c.id = checkpoint_messages.checkpoint_id
      AND p.account_id = auth.uid()
    )
  );
