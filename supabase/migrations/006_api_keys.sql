-- Bloque 8: API keys por usuario + config por agent_session
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─── Tabla de API keys por usuario ───────────────────────────────────────────

create table if not exists user_api_keys (
  account_id uuid not null references accounts(id) on delete cascade,
  provider   text not null,
  api_key    text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, provider)
);

alter table user_api_keys enable row level security;

drop policy if exists "api_keys_select" on user_api_keys;
create policy "api_keys_select" on user_api_keys
  for select using (account_id = auth.uid());

drop policy if exists "api_keys_insert" on user_api_keys;
create policy "api_keys_insert" on user_api_keys
  for insert with check (account_id = auth.uid());

drop policy if exists "api_keys_update" on user_api_keys;
create policy "api_keys_update" on user_api_keys
  for update using (account_id = auth.uid());

drop policy if exists "api_keys_delete" on user_api_keys;
create policy "api_keys_delete" on user_api_keys
  for delete using (account_id = auth.uid());

-- ─── Config por agent_session (para IA Local endpoint, etc.) ─────────────────

alter table agent_sessions
  add column if not exists config jsonb;
