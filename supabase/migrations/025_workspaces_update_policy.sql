-- SEC-007: workspaces no tiene política UPDATE — todo update con cliente de
-- usuario afecta 0 filas sin error (RLS deny-by-default). Lock/Unlock no persistía.
-- La 005 omitió deliberadamente el update ("ya no se necesita para este bloque")
-- y nunca se agregó después.
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- workspaces: update — misma cadena de ownership que select/insert/delete
drop policy if exists "workspaces_update" on workspaces;
create policy "workspaces_update" on workspaces
  for update using (
    exists (
      select 1 from teams t
      join projects p on p.id = t.project_id
      where t.id = workspaces.team_id and p.account_id = auth.uid()
    )
  );
