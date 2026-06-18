-- Migration 037: Human-to-human messages for Connected Teams
-- Date: 2026-06-18
-- Description: Enable direct human chat between host and invitee in isolated workspaces

-- 1. Create human_messages table
CREATE TABLE IF NOT EXISTS public.human_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid        NOT NULL REFERENCES public.team_connections(id) ON DELETE CASCADE,
  from_account_id uuid        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id   uuid        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.human_messages ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policy: can read if I am sender or receiver
DROP POLICY IF EXISTS "human_messages_select" ON public.human_messages;

CREATE POLICY "human_messages_select" ON public.human_messages
  FOR SELECT USING (
    from_account_id = auth.uid() OR to_account_id = auth.uid()
  );

-- 4. INSERT policy: can send only if I am part of active connection and recipient is the other participant
DROP POLICY IF EXISTS "human_messages_insert" ON public.human_messages;

CREATE POLICY "human_messages_insert" ON public.human_messages
  FOR INSERT WITH CHECK (
    from_account_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_connections tc
      WHERE tc.id = human_messages.connection_id
        AND tc.status = 'active'
        AND (
          (tc.requester_account_id = auth.uid() AND tc.receiver_account_id = human_messages.to_account_id)
          OR
          (tc.receiver_account_id = auth.uid() AND tc.requester_account_id = human_messages.to_account_id)
        )
    )
  );

-- 5. Comments
COMMENT ON TABLE public.human_messages IS
  'Direct human-to-human messages between Connected Teams participants. Not related to AI agent sessions.';

COMMENT ON POLICY "human_messages_select" ON public.human_messages IS
  'Users can read messages where they are sender or receiver.';

COMMENT ON POLICY "human_messages_insert" ON public.human_messages IS
  'Users can send messages only if they are part of an active connection and the recipient is the other participant.';
