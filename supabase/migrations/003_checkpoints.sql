-- Bloque 5: Checkpoints, mensajes del snapshot y Audit Log
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─── Tablas ──────────────────────────────────────────────────────────────────

-- Snapshot de conversación (cabecera)
create table if not exists checkpoints (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  name         text        not null,
  created_at   timestamptz not null default now()
);

-- Mensajes del snapshot (inmutables — copia independiente de messages)
create table if not exists checkpoint_messages (
  id            uuid  primary key default gen_random_uuid(),
  checkpoint_id uuid  not null references checkpoints(id) on delete cascade,
  session_id    uuid  not null references agent_sessions(id) on delete cascade,
  role          text  not null check (role in ('user', 'assistant')),
  content       text  not null,
  position      int   not null
);

-- Registro inmutable de eventos del workspace
create table if not exists audit_log (
  id           uuid        primary key default gen_random_uuid(),
  account_id   uuid        not null references accounts(id) on delete cascade,
  workspace_id uuid        references workspaces(id) on delete set null,
  event_type   text        not null,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table checkpoints         enable row level security;
alter table checkpoint_messages enable row level security;
alter table audit_log           enable row level security;

-- checkpoints: dueño del workspace
drop policy if exists "checkpoints_select" on checkpoints;
create policy "checkpoints_select" on checkpoints
  for select using (
    exists (
      select 1 from workspaces w
      join teams    t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = checkpoints.workspace_id and p.account_id = auth.uid()
    )
  );

drop policy if exists "checkpoints_insert" on checkpoints;
create policy "checkpoints_insert" on checkpoints
  for insert with check (
    exists (
      select 1 from workspaces w
      join teams    t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = checkpoints.workspace_id and p.account_id = auth.uid()
    )
  );

-- checkpoint_messages: a través del checkpoint → workspace → proyecto
drop policy if exists "checkpoint_messages_select" on checkpoint_messages;
create policy "checkpoint_messages_select" on checkpoint_messages
  for select using (
    exists (
      select 1 from checkpoints c
      join workspaces w on w.id = c.workspace_id
      join teams      t on t.id = w.team_id
      join projects   p on p.id = t.project_id
      where c.id = checkpoint_messages.checkpoint_id and p.account_id = auth.uid()
    )
  );

drop policy if exists "checkpoint_messages_insert" on checkpoint_messages;
create policy "checkpoint_messages_insert" on checkpoint_messages
  for insert with check (
    exists (
      select 1 from checkpoints c
      join workspaces w on w.id = c.workspace_id
      join teams      t on t.id = w.team_id
      join projects   p on p.id = t.project_id
      where c.id = checkpoint_messages.checkpoint_id and p.account_id = auth.uid()
    )
  );

-- audit_log: solo el propio usuario
drop policy if exists "audit_log_select" on audit_log;
create policy "audit_log_select" on audit_log
  for select using (account_id = auth.uid());

drop policy if exists "audit_log_insert" on audit_log;
create policy "audit_log_insert" on audit_log
  for insert with check (account_id = auth.uid());
