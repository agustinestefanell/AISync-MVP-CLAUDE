-- 062 — Trazabilidad de búsquedas web (OE 2026-09-29)
--
-- 1. message_id: vincula cada búsqueda con la respuesta del asistente que la
--    usó (messages.id). Sin FK formal a propósito: la fila de la búsqueda se
--    escribe ANTES de que exista la fila del mensaje (el mensaje se persiste
--    al terminar el stream), y messages es content plane (migrable). Puede
--    quedar apuntando a un mensaje que nunca se guardó (respuesta
--    interrumpida) — ver regla de huérfanas en AISyncPlans.md.
-- 2. status / error: una búsqueda fallida ahora deja fila. `error` guarda
--    solo una categoría sanitizada (nunca el mensaje crudo del proveedor).
-- 3. cited_urls: URLs limpias de las fuentes que la respuesta final cita.
--    NULL = todavía no evaluado; [] = evaluado, ninguna citada.
--
-- SIN policy de UPDATE a propósito: RLS no puede limitar un UPDATE a una
-- columna, y una búsqueda ya registrada no debe poder reescribirse. La única
-- escritura posterior (cited_urls) la hace /api/messages en el servidor con
-- el cliente admin, una sola vez (solo si cited_urls sigue en NULL).
--
-- Las 60 filas existentes quedan con status = 'success' (correcto: hasta hoy
-- solo se registraban búsquedas exitosas) y message_id / error / cited_urls
-- en NULL. ADD COLUMN con default constante no reescribe la tabla.

ALTER TABLE session_tool_calls
  ADD COLUMN message_id uuid,
  ADD COLUMN status     text  NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  ADD COLUMN error      text,
  ADD COLUMN cited_urls jsonb;

CREATE INDEX session_tool_calls_message_id_idx ON session_tool_calls (message_id);
CREATE INDEX session_attachments_message_id_idx ON session_attachments (message_id);
