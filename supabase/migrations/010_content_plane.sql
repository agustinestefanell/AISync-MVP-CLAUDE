-- BLOQUE 13: Control Plane vs Content Plane
-- Marca los objetos del content plane (propiedad del cliente, migrables)
-- y agrega comentarios de auditoría a las tablas de ambos planos.
-- Cero cambios funcionales — sólo metadatos y columnas de clasificación.

-- Marcar checkpoints como content plane del cliente
ALTER TABLE checkpoints
ADD COLUMN IF NOT EXISTS content_plane BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS migration_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS client_owned BOOLEAN DEFAULT true;

-- Marcar messages como content plane del cliente
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS content_plane BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS client_owned BOOLEAN DEFAULT true;

-- Marcar checkpoint_messages como content plane del cliente
ALTER TABLE checkpoint_messages
ADD COLUMN IF NOT EXISTS content_plane BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS client_owned BOOLEAN DEFAULT true;

-- Comentario de auditoría: control plane
COMMENT ON TABLE audit_log IS
'CONTROL PLANE — AISync operational traceability layer.
This table belongs to AISync infrastructure, not to client content.';

-- Comentarios de auditoría: content plane
COMMENT ON TABLE checkpoints IS
'CONTENT PLANE — Client-owned artifacts. Migratable to client
infrastructure in future phases. Do not treat as AISync canonical data.';

COMMENT ON TABLE messages IS
'CONTENT PLANE — Client-owned conversation content. Migratable.';
