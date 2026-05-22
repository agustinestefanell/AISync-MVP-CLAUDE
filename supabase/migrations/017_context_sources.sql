-- Context Sources — base de Context Files MVP
-- Material factual/documental para agentes, organizado por Project/Team/Session.
-- Semánticamente distinto de Prompt Library (instrucciones) y Documentation Mode (objetos canónicos).

CREATE TABLE IF NOT EXISTS context_sources (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  title                    TEXT        NOT NULL,
  source_kind              TEXT        CHECK (source_kind IN (
                                         'uploaded_file',
                                         'derived_context_note',
                                         'saved_selection_context',
                                         'external_reference'
                                       )),
  scope                    TEXT        CHECK (scope IN ('project', 'team', 'session')),
  project_id               TEXT,
  team_id                  TEXT,
  workspace_id             TEXT,
  session_id               TEXT,
  content_text             TEXT,
  file_path                TEXT,
  file_type                TEXT,
  file_size_bytes          INTEGER,
  status                   TEXT        NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('active', 'archived')),
  retention_mode           TEXT        NOT NULL DEFAULT 'persistent',
  extracted_text_available BOOLEAN     NOT NULL DEFAULT false,
  origin_type              TEXT,
  origin_message_id        TEXT,
  notes                    TEXT,
  tags                     TEXT[],
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE context_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own context sources"
  ON context_sources
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Supabase Storage: bucket context-files (privado) ──────────────────────────
-- Si la extensión storage está habilitada en el proyecto, el bucket se crea aquí.
-- Si este INSERT falla (extensión no disponible o permisos), crear el bucket
-- manualmente en Supabase Dashboard: Storage → New Bucket → "context-files" → Private.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('context-files', 'context-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage.objects del bucket context-files
-- El path format es: {userId}/{contextSourceId}/{safeFileName}
-- [1] = primer segmento del path = userId del propietario

CREATE POLICY "context_files_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'context-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "context_files_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'context-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "context_files_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'context-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMENT ON TABLE context_sources IS
'CONTROL PLANE — Context Files / Context Repository.
Material factual y documental para agentes, organizado por Project/Team/Session.
Distinto de prompt_library (instrucciones) y objetos Documentation Mode (canónicos).
Bucket storage: context-files (private). Path: {userId}/{contextSourceId}/{safeFileName}.';
