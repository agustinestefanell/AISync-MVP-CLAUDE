-- Bloque 4: Mensajes por agent_session
-- Ejecutar en: Supabase Dashboard → SQL Editor

create table if not exists messages (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references agent_sessions(id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

drop policy if exists "messages_select" on messages;
create policy "messages_select" on messages
  for select using (
    exists (
      select 1 from agent_sessions ags
      join workspaces w  on w.id  = ags.workspace_id
      join teams      t  on t.id  = w.team_id
      join projects   p  on p.id  = t.project_id
      where ags.id = messages.session_id and p.account_id = auth.uid()
    )
  );

drop policy if exists "messages_insert" on messages;
create policy "messages_insert" on messages
  for insert with check (
    exists (
      select 1 from agent_sessions ags
      join workspaces w  on w.id  = ags.workspace_id
      join teams      t  on t.id  = w.team_id
      join projects   p  on p.id  = t.project_id
      where ags.id = messages.session_id and p.account_id = auth.uid()
    )
  );
