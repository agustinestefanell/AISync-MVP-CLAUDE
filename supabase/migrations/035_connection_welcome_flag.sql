-- Migration 035: Welcome viewed flag for Connected Teams invitees
-- Date: 2026-06-18
-- Description: Track whether invitee has viewed the welcome screen for a connection

ALTER TABLE public.team_connections
  ADD COLUMN IF NOT EXISTS welcome_viewed_by_invitee boolean DEFAULT false;

COMMENT ON COLUMN public.team_connections.welcome_viewed_by_invitee IS
  'Tracks whether the invitee (receiver) has viewed the welcome screen for this connection.
   Used to show welcome modal only on first workspace access.';
