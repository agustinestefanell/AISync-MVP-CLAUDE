-- Migración 030: description and color for Connected Teams
-- Fecha: 2026-06-13
-- Propósito: Add human-readable description and visual color metadata to team_connections
--            for personalized Shared Session experience

ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#000000';

COMMENT ON COLUMN public.team_connections.description IS
  'Human-readable description of this connection for display in Dashboard and Teams Map. Required when creating connection.';

COMMENT ON COLUMN public.team_connections.color IS
  'Hex color for visual identification of Shared Session card. Default #000000 (black).';
