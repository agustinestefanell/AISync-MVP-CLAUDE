-- CONTROL PLANE — Prompt Library
-- Biblioteca de prompts del usuario: instrucciones gobernadas asignables a workers y teams.
-- Separación semántica obligatoria: Prompt Library = instrucciones, Context File = material.

-- ── Tabla principal ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_library (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  scope       TEXT        CHECK (scope IN ('worker', 'team')),
  status      TEXT        NOT NULL DEFAULT 'active',
  version     INTEGER     NOT NULL DEFAULT 1,
  tags        TEXT[],
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompt_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_library_select" ON prompt_library
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "prompt_library_insert" ON prompt_library
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "prompt_library_update" ON prompt_library
  FOR UPDATE USING (user_id = auth.uid());

-- ── Tabla de asignaciones ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id   UUID        NOT NULL REFERENCES prompt_library(id) ON DELETE CASCADE,
  assigned_to TEXT        NOT NULL CHECK (assigned_to IN ('worker', 'team')),
  target_id   TEXT        NOT NULL,
  agent_role  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompt_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_assignments_select" ON prompt_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM prompt_library WHERE id = prompt_assignments.prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "prompt_assignments_insert" ON prompt_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM prompt_library WHERE id = prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "prompt_assignments_update" ON prompt_assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM prompt_library WHERE id = prompt_assignments.prompt_id AND user_id = auth.uid())
  );

COMMENT ON TABLE prompt_library IS
'CONTROL PLANE — Biblioteca de prompts del usuario.
Instrucciones gobernadas asignables a workers (por session_id) o teams (por team_id).
No confundir con Context Files (material de contexto).';

COMMENT ON TABLE prompt_assignments IS
'CONTROL PLANE — Asignaciones activas de prompts a workers o teams.
assigned_to=worker: target_id=session_id, agent_role=manager|worker1|worker2
assigned_to=team: target_id=team_id, agent_role=null
Desactivar con is_active=false; no eliminar.';
