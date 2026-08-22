-- Migration 058: tags + saved_selection_tags — base de User Library.
-- User Library reemplaza a Structure View como tab de Documentation Mode
-- (2026-08-21) — se basa únicamente en Save Selection, organizado por tags
-- manuales libres (no carpetas anidadas). Un Save Selection puede tener
-- varios tags.
--
-- Decisión (Paso 0, confirmada con Agus): sin columna in_user_library en
-- saved_selections — "estar en la library" se deriva de tener al menos 1
-- fila en saved_selection_tags. El modal de Save Selection exige elegir al
-- menos 1 tag cuando el usuario tilda "Add to User Library", así que no
-- existe en la práctica un Save Selection con el checkbox tildado y 0 tags.
--
-- account_id (no user_id) en `tags`, siguiendo la convención más reciente
-- del proyecto para tablas de ownership directo (ver investigation_snapshot,
-- migración 056) en vez de la convención vieja de saved_selections/
-- prompt_library (user_id -> auth.users). accounts.id == auth.uid() por
-- diseño (trigger handle_new_user, 000_accounts_baseline.sql).

CREATE TABLE IF NOT EXISTS tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON tags
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "tags_insert" ON tags
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY "tags_update" ON tags
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY "tags_delete" ON tags
  FOR DELETE USING (account_id = auth.uid());

-- Junction muchos-a-muchos — sin columna de ownership propia, RLS vía EXISTS
-- contra saved_selections (mismo patrón ya usado por prompt_assignments/
-- message_provenance para ownership indirecto vía la tabla padre).
CREATE TABLE IF NOT EXISTS saved_selection_tags (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_selection_id UUID        NOT NULL REFERENCES saved_selections(id) ON DELETE CASCADE,
  tag_id             UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (saved_selection_id, tag_id)
);

CREATE INDEX IF NOT EXISTS saved_selection_tags_selection_idx ON saved_selection_tags (saved_selection_id);
CREATE INDEX IF NOT EXISTS saved_selection_tags_tag_idx       ON saved_selection_tags (tag_id);

ALTER TABLE saved_selection_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_selection_tags_select" ON saved_selection_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_selections ss
      WHERE ss.id = saved_selection_tags.saved_selection_id AND ss.user_id = auth.uid()
    )
  );

CREATE POLICY "saved_selection_tags_insert" ON saved_selection_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_selections ss
      WHERE ss.id = saved_selection_id AND ss.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM tags t
      WHERE t.id = tag_id AND t.account_id = auth.uid()
    )
  );

CREATE POLICY "saved_selection_tags_delete" ON saved_selection_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM saved_selections ss
      WHERE ss.id = saved_selection_tags.saved_selection_id AND ss.user_id = auth.uid()
    )
  );

COMMENT ON TABLE tags IS
'CONTENT PLANE — tags manuales libres del usuario para User Library. Sin
jerarquía/carpetas anidadas. Nombre único por cuenta (UNIQUE account_id,name).';

COMMENT ON TABLE saved_selection_tags IS
'CONTENT PLANE — relación muchos-a-muchos Save Selection <-> Tag. Un Save
Selection "está en User Library" si y solo si tiene al menos 1 fila acá
(sin columna in_user_library en saved_selections — ver Decisión 2026-08-21
en DECISIONS.md).';
