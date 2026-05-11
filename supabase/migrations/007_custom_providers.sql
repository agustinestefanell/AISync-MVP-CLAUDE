-- Bloque 8b: Providers personalizados por usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor

create table if not exists user_custom_providers (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references accounts(id) on delete cascade,
  name        text        not null,
  endpoint_url text       not null,
  api_key     text        not null,
  model       text        not null,
  created_at  timestamptz not null default now(),
  unique(account_id, name)
);

alter table user_custom_providers enable row level security;

drop policy if exists "custom_providers_select" on user_custom_providers;
create policy "custom_providers_select" on user_custom_providers
  for select using (account_id = auth.uid());

drop policy if exists "custom_providers_insert" on user_custom_providers;
create policy "custom_providers_insert" on user_custom_providers
  for insert with check (account_id = auth.uid());

drop policy if exists "custom_providers_update" on user_custom_providers;
create policy "custom_providers_update" on user_custom_providers
  for update using (account_id = auth.uid());

drop policy if exists "custom_providers_delete" on user_custom_providers;
create policy "custom_providers_delete" on user_custom_providers
  for delete using (account_id = auth.uid());
