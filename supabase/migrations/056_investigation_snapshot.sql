-- Migration 056: investigation_snapshot + system prompt propio para
-- Investigate View (Fase A) — Session Scan / Deep Search.
-- 2026-08-20

CREATE TABLE investigation_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  investigation_focus TEXT,
  scope_project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  scope_team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  scope_date_start    TIMESTAMPTZ,
  scope_date_end      TIMESTAMPTZ,
  anchor_object_type  TEXT NOT NULL CHECK (anchor_object_type IN
                         ('checkpoint', 'handoff_package', 'saved_selection', 'loaded_context', 'review_forward')),
  anchor_object_id    TEXT NOT NULL,
  scan_mode           TEXT NOT NULL CHECK (scan_mode IN ('session_scan', 'deep_search')),
  sources_scanned     JSONB NOT NULL DEFAULT '[]',
  sources_not_scanned JSONB NOT NULL DEFAULT '[]',
  verdict             TEXT NOT NULL CHECK (verdict IN ('yes', 'partial', 'no', 'inconclusive')),
  justification       TEXT NOT NULL,
  evidence_refs       JSONB NOT NULL DEFAULT '[]',
  summary             TEXT,
  provider_used       TEXT,
  model_used          TEXT,
  created_by          UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investigation_snapshot_account_idx ON investigation_snapshot(account_id, created_at DESC);

ALTER TABLE investigation_snapshot ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que audit_log (003_checkpoints.sql): account_id directo,
-- sin join polimórfico — anchor_object_type es polimórfico igual que
-- message_provenance.source_object_type, y audit_log ya resuelve ese mismo
-- caso con una columna de ownership directa en vez de un EXISTS por tipo.
CREATE POLICY "investigation_snapshot_select" ON investigation_snapshot
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "investigation_snapshot_insert" ON investigation_snapshot
  FOR INSERT WITH CHECK (account_id = auth.uid());

COMMENT ON TABLE investigation_snapshot IS
'CONTENT PLANE — resultado persistido de una corrida de Session Scan/Deep
Search (Investigate View, Fase A, 2026-08-20). anchor_object_id no tiene FK
real (polimórfico: checkpoint/handoff_package/saved_selection/loaded_context
apunta a context_sources.id o message_provenance.id según flavor/review_forward
apunta a audit_log.id) — mismo tradeoff ya aceptado en message_provenance.';

-- System prompt propio (Capa 1) — endpoint /api/investigation-scan NO
-- reusa sm_documentation/sm_audit (SM lateral existente, comportamiento
-- ambiguo sin diagnosticar). Solo puede citar evidencia real presente en
-- los mensajes escaneados, nunca inventar contenido, y debe declarar
-- explícitamente evidencia insuficiente (mapea a verdict "inconclusive").
INSERT INTO system_prompts (role, display_name, base_layer, role_prompt) VALUES

('investigation_scan', 'Investigation Scan',
'AISync es una institución cognitiva de trabajo humano–IA. Operas con tono profesional, sobrio, claro, directo y no complaciente. Prioriza claridad, estructura, economía verbal y utilidad operativa. No inventes información bajo ninguna circunstancia.',
'Tu única función es analizar una investigación puntual contra evidencia real de mensajes de chat que se te proveen, y devolver un veredicto estructurado. Reglas obligatorias, sin excepción: 1. Solo podés citar como evidencia contenido que aparece literalmente en los mensajes provistos. Nunca inventes, asumas, ni completes información que no esté presente. 2. Si la evidencia disponible no alcanza para responder la pregunta de investigación con confianza, tu verdict DEBE ser "inconclusive" — no fuerces una respuesta "yes"/"no"/"partial" sin evidencia suficiente. 3. Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido, sin texto antes ni después, sin bloque de código markdown, con esta forma exacta: {"verdict": "yes"|"partial"|"no"|"inconclusive", "justification": "resumen breve en 2-4 oraciones de por qué llegaste a este verdict, citando qué evidencia lo sostiene o por qué no alcanza", "evidence": [{"source": "descripción breve de quién/qué mensaje", "excerpt": "cita textual corta, no más de 200 caracteres", "timestamp": "timestamp ISO del mensaje citado si está disponible"}]}. 4. El array evidence puede estar vacío si el verdict es "inconclusive" por falta total de evidencia relevante. 5. No agregues campos fuera de los 3 definidos. No agregues comentarios ni explicación fuera del JSON.')

ON CONFLICT (role) DO NOTHING;
