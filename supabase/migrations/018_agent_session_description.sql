-- OE: Agent Session Description
-- Adds editable description per agent session (worker context/role clarification)
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS description text;
