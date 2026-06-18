-- Migration 038: Extend checkpoint_messages to support human messages
-- Date: 2026-06-18
-- Description: Allow checkpoints and saved_selections to include human-to-human messages
--              from Connected Teams chat panel

-- 1. Add message_type column to checkpoint_messages
ALTER TABLE public.checkpoint_messages
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'agent' CHECK (message_type IN ('agent', 'human'));

-- 2. Make session_id nullable (required when message_type='human')
ALTER TABLE public.checkpoint_messages
  ALTER COLUMN session_id DROP NOT NULL;

-- 3. Add connection_id for human messages
ALTER TABLE public.checkpoint_messages
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.team_connections(id) ON DELETE SET NULL;

-- 4. Add constraint: agent messages need session_id, human messages need connection_id
ALTER TABLE public.checkpoint_messages
  DROP CONSTRAINT IF EXISTS checkpoint_messages_type_integrity;

ALTER TABLE public.checkpoint_messages
  ADD CONSTRAINT checkpoint_messages_type_integrity CHECK (
    (message_type = 'agent' AND session_id IS NOT NULL AND connection_id IS NULL)
    OR
    (message_type = 'human' AND connection_id IS NOT NULL AND session_id IS NULL)
  );

-- 5. Comments
COMMENT ON COLUMN public.checkpoint_messages.message_type IS
  'Type of message: "agent" for AI agent messages, "human" for human-to-human messages.';

COMMENT ON COLUMN public.checkpoint_messages.connection_id IS
  'For human messages: references the team_connection where the message originated.';

COMMENT ON CONSTRAINT checkpoint_messages_type_integrity ON public.checkpoint_messages IS
  'Ensures agent messages have session_id and human messages have connection_id, but not both.';
