-- Agregar política UPDATE faltante en messages
--
-- Motivo:
-- La tabla messages fue creada en migración 002 con políticas SELECT e INSERT,
-- pero sin política UPDATE. Esto no se manifestó hasta la feature de resumen AI
-- de adjuntos (commits c32e9c1 y 09fa3d2), que necesita actualizar
-- messages.attachment_metadata.ai_summary después del INSERT inicial.
--
-- Evidencia real en producción:
-- - audit_log recibió attachment_summary_generated correctamente (INSERT permitido).
-- - messages.attachment_metadata.ai_summary nunca apareció (UPDATE bloqueado por RLS).
--
-- Esta migración agrega la política UPDATE con la misma cadena de ownership
-- usada por messages_select y messages_insert.

drop policy if exists "messages_update" on messages;

create policy "messages_update" on messages
  for update
  using (
    exists (
      select 1 from agent_sessions ags
      join workspaces w  on w.id  = ags.workspace_id
      join teams      t  on t.id  = w.team_id
      join projects   p  on p.id  = t.project_id
      where ags.id = messages.session_id and p.account_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from agent_sessions ags
      join workspaces w  on w.id  = ags.workspace_id
      join teams      t  on t.id  = w.team_id
      join projects   p  on p.id  = t.project_id
      where ags.id = messages.session_id and p.account_id = auth.uid()
    )
  );
