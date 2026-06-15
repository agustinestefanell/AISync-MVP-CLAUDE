-- Add color column to teams table
-- Required for isolated teams to persist connection color independently of connection state

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#000000';

COMMENT ON COLUMN teams.color IS
'Team card color. For isolated teams, copied from team_connections.color at accept time.
For regular teams, set by user. Defaults to black.';
