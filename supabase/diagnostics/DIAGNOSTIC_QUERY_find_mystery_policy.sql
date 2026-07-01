-- DIAGNOSTIC QUERY: Find the mystery "Invitee can read isolated team" policy
-- Execute in: Supabase Dashboard → SQL Editor
-- Purpose: Locate and inspect the policy that's blocking DROP COLUMN scope_isolated_team_id

-- Query 1: Find the specific policy on teams table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'teams'
  AND schemaname = 'public'
ORDER BY policyname;

-- Query 2: Get detailed definition of the specific policy (if it exists)
SELECT
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression,
  pol.polpermissive AS is_permissive
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'teams'
  AND n.nspname = 'public'
  AND pol.polname = 'Invitee can read isolated team'
ORDER BY pol.polname;

-- Query 3: List ALL policies on teams (to understand full RLS setup)
SELECT
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'teams'
  AND n.nspname = 'public'
ORDER BY pol.polname;
