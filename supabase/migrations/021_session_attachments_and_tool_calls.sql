-- Session attachments and tool calls
-- Ephemeral traceability tables for workspace sessions.
-- Ownership follows:
-- session_id -> agent_sessions -> workspaces -> teams -> projects -> account_id = auth.uid()

CREATE TABLE session_attachments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      text,
  session_id      uuid        REFERENCES agent_sessions(id) ON DELETE CASCADE,
  workspace_id    uuid        REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  filename        text        NOT NULL,
  mime_type       text        NOT NULL,
  size_bytes      integer,
  attachment_type text        NOT NULL CHECK (attachment_type IN ('image', 'document')),
  provider        text,
  status          text        NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processed', 'expired', 'deleted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

ALTER TABLE session_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_attachments_select ON session_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM agent_sessions s
      JOIN workspaces w ON w.id = s.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE s.id = session_attachments.session_id
        AND p.account_id = auth.uid()
    )
  );

CREATE POLICY session_attachments_insert ON session_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM agent_sessions s
      JOIN workspaces w ON w.id = s.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE s.id = session_attachments.session_id
        AND p.account_id = auth.uid()
    )
  );

CREATE TABLE session_tool_calls (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        REFERENCES agent_sessions(id) ON DELETE CASCADE,
  workspace_id   uuid        REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name      text        NOT NULL,
  query          text,
  provider       text,
  model          text,
  result_summary text,
  sources        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_tool_calls_select ON session_tool_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM agent_sessions s
      JOIN workspaces w ON w.id = s.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE s.id = session_tool_calls.session_id
        AND p.account_id = auth.uid()
    )
  );

CREATE POLICY session_tool_calls_insert ON session_tool_calls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM agent_sessions s
      JOIN workspaces w ON w.id = s.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE s.id = session_tool_calls.session_id
        AND p.account_id = auth.uid()
    )
  );
