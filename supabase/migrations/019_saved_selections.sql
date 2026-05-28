create table saved_selections (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  workspace_id  uuid        references workspaces(id) on delete cascade not null,
  team_id       uuid        references teams(id) on delete cascade,
  project_id    uuid        references projects(id) on delete cascade,
  name          text        not null,
  messages      jsonb       not null default '[]',
  created_at    timestamptz default now() not null
);

alter table saved_selections enable row level security;

create policy "Users can manage their own saved selections"
  on saved_selections
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
