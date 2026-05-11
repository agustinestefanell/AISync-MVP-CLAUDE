-- CONTROL PLANE — System prompts son infraestructura de AISync.
-- El usuario no puede leer ni editar esta tabla.
-- El acceso se hace exclusivamente desde server-side con service_role key.

CREATE TABLE IF NOT EXISTS system_prompts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role        TEXT        NOT NULL UNIQUE,
  display_name TEXT       NOT NULL,
  base_layer  TEXT        NOT NULL,
  role_prompt TEXT        NOT NULL,
  is_active   BOOLEAN     DEFAULT true,
  version     INTEGER     DEFAULT 1,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  TEXT        DEFAULT 'system'
);

ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Ningún cliente puede acceder — solo service_role desde server-side
CREATE POLICY "Admin only" ON system_prompts
  FOR ALL USING (false);
