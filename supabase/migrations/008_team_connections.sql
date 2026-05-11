-- Bloque 9: Conexiones entre teams de cuentas distintas
-- Ejecutar en: Supabase Dashboard → SQL Editor

create table if not exists team_connections (
  id                    uuid        primary key default gen_random_uuid(),

  -- Lado solicitante
  requester_account_id  uuid        not null references accounts(id) on delete cascade,
  requester_email       text        not null,  -- denormalizado para display cross-account
  requester_team_id     uuid        not null references teams(id) on delete cascade,
  requester_team_name   text        not null,  -- denormalizado

  -- Lado receptor
  receiver_email        text        not null,
  receiver_account_id   uuid        references accounts(id) on delete cascade,
  receiver_team_id      uuid        references teams(id) on delete set null,
  receiver_team_name    text,       -- se setea al aceptar

  -- Configuración de la conexión (room para expansión)
  connection_type       text        not null default 'project-bound'
                          check (connection_type in ('project-bound', 'persistent-partner')),
  scope                 text        not null default 'no-shared-repo'
                          check (scope in ('no-shared-repo', 'shared-project-repo')),

  status                text        not null default 'pending'
                          check (status in ('pending', 'active', 'rejected', 'cancelled')),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table team_connections enable row level security;

-- Requester ve sus outgoing
drop policy if exists "connections_requester_select" on team_connections;
create policy "connections_requester_select" on team_connections
  for select using (requester_account_id = auth.uid());

-- Receptor ve incoming por email (antes de aceptar) o por account_id (después)
drop policy if exists "connections_receiver_select" on team_connections;
create policy "connections_receiver_select" on team_connections
  for select using (
    receiver_account_id = auth.uid()
    OR receiver_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "connections_insert" on team_connections;
create policy "connections_insert" on team_connections
  for insert with check (requester_account_id = auth.uid());

drop policy if exists "connections_update" on team_connections;
create policy "connections_update" on team_connections
  for update using (
    requester_account_id = auth.uid()
    OR receiver_account_id = auth.uid()
    OR receiver_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "connections_delete" on team_connections;
create policy "connections_delete" on team_connections
  for delete using (requester_account_id = auth.uid());
