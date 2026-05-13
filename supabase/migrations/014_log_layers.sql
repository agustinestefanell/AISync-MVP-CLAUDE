-- CAPA 2: System/Security Log
CREATE TABLE IF NOT EXISTS system_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  payload JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_log ENABLE ROW LEVEL SECURITY;
-- Solo admin puede leer
CREATE POLICY "Admin only system_log" ON system_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE system_log IS
'CONTROL PLANE — Layer 2: System/Security Log.
Technical events, errors, unauthorized access attempts, rate limits.
Not visible to regular users. Admin Panel only.';

-- CAPA 3: Preservation/Provenance Event Store
CREATE TABLE IF NOT EXISTS provenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'system'
    CHECK (agent_type IN ('user', 'system', 'admin')),
  agent_id UUID,
  relation_type TEXT,
  related_object_id UUID,
  related_object_type TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE provenance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only provenance_log" ON provenance_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE provenance_log IS
'CONTROL PLANE — Layer 3: Preservation/Provenance Event Store.
Object relationships, integrity events, indexing, migrations.
Foundation for future fixity/checksum implementation.';
