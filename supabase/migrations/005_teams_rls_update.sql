-- Bloque 7: RLS update/delete policies para teams y agent_sessions
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- teams: update y delete
drop policy if exists "teams_update" on teams;
create policy "teams_update" on teams
  for update using (
    exists (select 1 from projects p where p.id = teams.project_id and p.account_id = auth.uid())
  );

drop policy if exists "teams_delete" on teams;
create policy "teams_delete" on teams
  for delete using (
    exists (select 1 from projects p where p.id = teams.project_id and p.account_id = auth.uid())
  );

-- workspaces: delete (update ya no se necesita para este bloque)
drop policy if exists "workspaces_delete" on workspaces;
create policy "workspaces_delete" on workspaces
  for delete using (
    exists (
      select 1 from teams t
      join projects p on p.id = t.project_id
      where t.id = workspaces.team_id and p.account_id = auth.uid()
    )
  );

-- agent_sessions: update y delete
drop policy if exists "agent_sessions_update" on agent_sessions;
create policy "agent_sessions_update" on agent_sessions
  for update using (
    exists (
      select 1 from workspaces w
      join teams t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = agent_sessions.workspace_id and p.account_id = auth.uid()
    )
  );

drop policy if exists "agent_sessions_delete" on agent_sessions;
create policy "agent_sessions_delete" on agent_sessions
  for delete using (
    exists (
      select 1 from workspaces w
      join teams t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = agent_sessions.workspace_id and p.account_id = auth.uid()
    )
  );
