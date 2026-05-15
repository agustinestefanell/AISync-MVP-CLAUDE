ALTER TABLE teams
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS lead_role TEXT DEFAULT 'worker'
  CHECK (lead_role IN ('manager', 'submanager', 'worker')),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN teams.description IS
'User-written description shown in the MAP node card.
2-3 lines max. Updated by user via Edit modal.';
