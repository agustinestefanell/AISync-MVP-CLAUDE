-- Bloque 3: Jerarquía base de AISync
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists projects (
  id         uuid        primary key default gen_random_uuid(),
  account_id uuid        not null references accounts(id) on delete cascade,
  name       text        not null,
  status     text        not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  name       text        not null,
  type       text        not null check (type in ('SAT', 'MAT')),
  parent_id  uuid        references teams(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references teams(id) on delete cascade,
  name       text        not null,
  lock_state text        not null default 'unlocked' check (lock_state in ('unlocked', 'locked')),
  created_at timestamptz not null default now()
);

create table if not exists agent_sessions (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  agent_role   text        not null check (agent_role in ('manager', 'worker1', 'worker2')),
  provider     text        not null,
  model        text        not null,
  created_at   timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table projects      enable row level security;
alter table teams         enable row level security;
alter table workspaces    enable row level security;
alter table agent_sessions enable row level security;

-- projects: solo el dueño
create policy "projects_select" on projects
  for select using (account_id = auth.uid());

create policy "projects_insert" on projects
  for insert with check (account_id = auth.uid());

create policy "projects_update" on projects
  for update using (account_id = auth.uid());

-- teams: a través del proyecto
create policy "teams_select" on teams
  for select using (
    exists (select 1 from projects p where p.id = teams.project_id and p.account_id = auth.uid())
  );

create policy "teams_insert" on teams
  for insert with check (
    exists (select 1 from projects p where p.id = teams.project_id and p.account_id = auth.uid())
  );

-- workspaces: a través de team → project
create policy "workspaces_select" on workspaces
  for select using (
    exists (
      select 1 from teams t
      join projects p on p.id = t.project_id
      where t.id = workspaces.team_id and p.account_id = auth.uid()
    )
  );

create policy "workspaces_insert" on workspaces
  for insert with check (
    exists (
      select 1 from teams t
      join projects p on p.id = t.project_id
      where t.id = workspaces.team_id and p.account_id = auth.uid()
    )
  );

-- agent_sessions: a través de workspace → team → project
create policy "agent_sessions_select" on agent_sessions
  for select using (
    exists (
      select 1 from workspaces w
      join teams t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = agent_sessions.workspace_id and p.account_id = auth.uid()
    )
  );

create policy "agent_sessions_insert" on agent_sessions
  for insert with check (
    exists (
      select 1 from workspaces w
      join teams t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = agent_sessions.workspace_id and p.account_id = auth.uid()
    )
  );
