-- Token usage tracking
-- Captures AI provider token consumption per session/workspace/account.
-- Designed for billing readiness, metrics, and per-account limits.

create table if not exists public.token_usage (
  id            uuid        primary key default gen_random_uuid(),
  account_id    uuid        not null,
  workspace_id  uuid,
  session_id    uuid,
  provider      text        not null,
  model         text        not null,
  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  total_tokens  integer     not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.token_usage enable row level security;

create policy "Users can view their own token usage"
on public.token_usage
for select
using (account_id = auth.uid());

create policy "Users can insert their own token usage"
on public.token_usage
for insert
with check (account_id = auth.uid());
