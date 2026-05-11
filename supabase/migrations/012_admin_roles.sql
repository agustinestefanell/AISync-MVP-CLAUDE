-- Bloque 16: Admin roles and status on accounts

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('owner', 'admin', 'user'));

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'suspended', 'pending'));

-- Promote owner
UPDATE accounts
SET role = 'owner'
WHERE email = 'agustinestefanell@gmail.com';

-- Verify before continuing:
-- SELECT email, role, status FROM accounts;

-- Ensure RLS is enabled on accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Users can read their own account row
CREATE POLICY "Users read own account" ON accounts
FOR SELECT USING (auth.uid() = id);

-- Admins and owners can read all accounts
CREATE POLICY "Admins read all accounts" ON accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM accounts a2
    WHERE a2.id = auth.uid()
    AND a2.role IN ('owner', 'admin')
  )
);

-- Admin events table for traceability
CREATE TABLE IF NOT EXISTS admin_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  UUID        NOT NULL,
  action         TEXT        NOT NULL,
  target_user_id UUID,
  payload        JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only events" ON admin_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM accounts
    WHERE id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);
