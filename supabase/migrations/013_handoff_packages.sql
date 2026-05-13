CREATE TABLE IF NOT EXISTS handoff_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  messages JSONB NOT NULL DEFAULT '[]',
  context TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'received', 'archived')),
  content_plane BOOLEAN DEFAULT true,
  client_owned BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE handoff_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own handoff packages" ON handoff_packages
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE handoff_packages IS
'CONTENT PLANE — Client-owned formal transfer objects.
Born only by explicit user decision. Never auto-created by Review & Forward.';
