-- Migration 051: Make handoff_packages.to_agent nullable
-- Handoff Package immediate creation without modal
-- 2026-07-30
--
-- Context:
-- Original schema had to_agent TEXT NOT NULL, enforcing a destination.
-- New UX creates packages immediately from a specific panel without
-- requiring the user to select a recipient — to_agent becomes null.
--
-- Change:
-- - Remove NOT NULL constraint from to_agent
-- - Allow NULL to indicate "no specific recipient" (general handoff)
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Remove NOT NULL constraint from to_agent
ALTER TABLE public.handoff_packages
  ALTER COLUMN to_agent DROP NOT NULL;

-- Update comment to reflect nullable behavior
COMMENT ON COLUMN public.handoff_packages.to_agent IS
  'Agent role the handoff is directed to. NULL indicates no specific recipient (general handoff created directly from a panel without modal selection).';
