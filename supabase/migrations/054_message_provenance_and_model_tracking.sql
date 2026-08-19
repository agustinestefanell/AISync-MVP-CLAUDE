-- Migration 054: message_provenance + provider/model tracking on messages
-- Audit View redesign — Fase 1.5: cierra 2 huecos de trazabilidad antes
-- de construir la UI de Audit View (Fase 2).
-- 2026-08-19

-- ── Pieza A — FK real: Load Saved Context → Chat ────────────────────────────
-- source_object_type usa 'handoff_package' (no 'handoff') para ser consistente
-- con la convención ya establecida en context_sources.origin_type (migración
-- 017) — mismo objeto, mismo nombre de tipo en todo el sistema.
CREATE TABLE IF NOT EXISTS message_provenance (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_object_type  TEXT        NOT NULL CHECK (source_object_type IN ('checkpoint', 'handoff_package', 'saved_selection')),
  source_object_id    UUID        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_provenance_message_idx ON message_provenance (message_id);
CREATE INDEX IF NOT EXISTS message_provenance_source_idx  ON message_provenance (source_object_type, source_object_id);

ALTER TABLE message_provenance ENABLE ROW LEVEL SECURITY;

-- Mismo criterio de scope que messages_select/messages_insert (002_messages.sql):
-- ownership vía message → agent_session → workspace → team → project.
DROP POLICY IF EXISTS "message_provenance_select" ON message_provenance;
CREATE POLICY "message_provenance_select" ON message_provenance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN agent_sessions ags ON ags.id = m.session_id
      JOIN workspaces w       ON w.id  = ags.workspace_id
      JOIN teams t            ON t.id  = w.team_id
      JOIN projects p         ON p.id  = t.project_id
      WHERE m.id = message_provenance.message_id AND p.account_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message_provenance_insert" ON message_provenance;
CREATE POLICY "message_provenance_insert" ON message_provenance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN agent_sessions ags ON ags.id = m.session_id
      JOIN workspaces w       ON w.id  = ags.workspace_id
      JOIN teams t            ON t.id  = w.team_id
      JOIN projects p         ON p.id  = t.project_id
      WHERE m.id = message_provenance.message_id AND p.account_id = auth.uid()
    )
  );

COMMENT ON TABLE message_provenance IS
'CONTROL PLANE — FK real para "Load Saved Context → Chat". Un mensaje puede
tener a lo sumo una fila de proveniencia (el mensaje que efectivamente se
cargó desde Documentation Mode). No retroactivo — solo mensajes creados
después de esta migración pueden tener fila asociada.';

-- ── Pieza B — provider/model reales por mensaje (hacia adelante) ───────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model    TEXT;

COMMENT ON COLUMN messages.provider IS
'Provider de agent_sessions al momento en que este mensaje se persistió.
NULL en mensajes anteriores a esta migración — interpretar como "no
disponible", no como error. No se recalcula retroactivamente si el agente
cambia de provider después.';

COMMENT ON COLUMN messages.model IS
'Mismo criterio que messages.provider, para el modelo.';
