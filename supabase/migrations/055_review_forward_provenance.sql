-- Migration 055: extend message_provenance to Review & Forward (Agent↔Agent)
-- Audit View redesign — Fase 1.6: cierra el hueco de downstream tracking para
-- Review & Forward antes de construir la UI de Audit View (Fase 2).
-- 2026-08-19

ALTER TABLE message_provenance DROP CONSTRAINT IF EXISTS message_provenance_source_object_type_check;
ALTER TABLE message_provenance ADD CONSTRAINT message_provenance_source_object_type_check
  CHECK (source_object_type IN ('checkpoint', 'handoff_package', 'saved_selection', 'review_forward'));

COMMENT ON TABLE message_provenance IS
'CONTROL PLANE — FK real para "Load Saved Context → Chat" (migración 054) y
"Review & Forward" Agent↔Agent (migración 055). Un mensaje puede tener a lo
sumo una fila de proveniencia. No retroactivo — solo mensajes creados después
de la migración correspondiente pueden tener fila asociada.
review_forward: source_object_id apunta a audit_log.id del evento review_forward
que originó el mensaje reenviado. No cubre la variante hacia chat humano
(destino human_messages, tabla distinta — sin FK posible hacia messages.id).';
