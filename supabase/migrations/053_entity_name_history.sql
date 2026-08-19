-- Migration 053: entity_name_history table
-- Audit View redesign — Fase 1: name-change history for Project and Team.
-- 2026-08-19

CREATE TABLE IF NOT EXISTS entity_name_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT        NOT NULL CHECK (entity_type IN ('project', 'team')),
  entity_id   UUID        NOT NULL,
  old_name    TEXT        NOT NULL,
  new_name    TEXT        NOT NULL,
  changed_by  UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_name_history_entity_idx
  ON entity_name_history (entity_type, entity_id);

ALTER TABLE entity_name_history ENABLE ROW LEVEL SECURITY;

-- Same scope criteria as projects/teams RLS (see 001_hierarchy.sql, 005_teams_rls_update.sql):
-- a row is visible/insertable only if the referenced Project or Team belongs to the caller's account.
DROP POLICY IF EXISTS "entity_name_history_select" ON entity_name_history;
CREATE POLICY "entity_name_history_select" ON entity_name_history
  FOR SELECT USING (
    (entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = entity_name_history.entity_id AND p.account_id = auth.uid()
    ))
    OR
    (entity_type = 'team' AND EXISTS (
      SELECT 1 FROM teams t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = entity_name_history.entity_id AND p.account_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "entity_name_history_insert" ON entity_name_history;
CREATE POLICY "entity_name_history_insert" ON entity_name_history
  FOR INSERT WITH CHECK (
    (entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = entity_name_history.entity_id AND p.account_id = auth.uid()
    ))
    OR
    (entity_type = 'team' AND EXISTS (
      SELECT 1 FROM teams t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = entity_name_history.entity_id AND p.account_id = auth.uid()
    ))
  );

COMMENT ON TABLE entity_name_history IS
'CONTROL PLANE — Immutable log of name changes for Project and Team, feeding the redesigned Audit View (Fase 2, separate OE). One row per rename, oldest first by changed_at.';
