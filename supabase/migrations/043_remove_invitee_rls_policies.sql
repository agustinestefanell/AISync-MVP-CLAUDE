-- Migration 043: Remove redundant invitee RLS policies
-- Date: 2026-06-29
-- Etapa 5 of 8-stage Connected Teams correction plan
--
-- Context:
--   With the two-building architecture (Etapas 0-4) now validated in production,
--   invitee users access their OWN isolated workspace/team/project (with their
--   own account_id as owner). The original ownership-based RLS policies
--   (p.account_id = auth.uid()) now correctly cover BOTH host and invitee.
--
-- Decision:
--   The special cross-account invitee policies added in migrations 040 and 041
--   are now redundant and can be safely removed. All active connections have
--   host_isolated_team_id and invitee_isolated_team_id populated (confirmed
--   2026-06-29). Legacy connections with only scope_isolated_team_id are all
--   cancelled and no longer relevant.
--
-- Impact:
--   - Host: NO CHANGE (always used ownership policy)
--   - Invitee: NO CHANGE in access (now uses ownership policy instead of special policy)
--   - Security: NO REGRESSION (removing redundant access path, not expanding access)
--
-- See: DECISIONS.md 2026-06-26, handoff.md 2026-06-29

-- ── messages ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Invitee can read messages in isolated workspace" ON public.messages;
DROP POLICY IF EXISTS "Invitee can insert messages in isolated workspace" ON public.messages;

-- ── checkpoints ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Invitee can read checkpoints in isolated workspace" ON public.checkpoints;
DROP POLICY IF EXISTS "Invitee can insert checkpoints in isolated workspace" ON public.checkpoints;

-- ── checkpoint_messages ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Invitee can read checkpoint_messages in isolated workspace" ON public.checkpoint_messages;
DROP POLICY IF EXISTS "Invitee can insert checkpoint_messages in isolated workspace" ON public.checkpoint_messages;

-- ── Final state ───────────────────────────────────────────────────────────────
--
-- After this migration, ALL users (host and invitee) access messages, checkpoints,
-- and checkpoint_messages exclusively through the original ownership-based policies:
--
--   messages_select / messages_insert (from migration 002)
--   checkpoints_select / checkpoints_insert (from migration 003)
--   checkpoint_messages_select / checkpoint_messages_insert (from migration 003)
--
-- These policies check: p.account_id = auth.uid()
-- This works correctly for:
--   - Host: owns their project → can access their workspace's data ✓
--   - Invitee: owns their project → can access their workspace's data ✓
