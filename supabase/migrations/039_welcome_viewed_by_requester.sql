-- Migration 039: Welcome viewed flag for Connected Teams requesters (hosts)
-- Date: 2026-06-22
-- Description: Track whether requester (host) has viewed the welcome screen for a connection

ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS welcome_viewed_by_requester boolean DEFAULT false;

COMMENT ON COLUMN public.team_connections.welcome_viewed_by_requester IS
  'Tracks whether the requester (host) has viewed the welcome screen for this connection.
   Used to show welcome modal only on first workspace access after invitee accepts.';
