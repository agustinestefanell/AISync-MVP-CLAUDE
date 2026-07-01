-- DIAGNOSTIC QUERY: Find ALL RLS policies that reference scope_isolated_team_id or scope_isolated_workspace_id
-- Execute in: Supabase Dashboard → SQL Editor
-- Purpose: Complete audit before dropping scope_isolated_* columns (Etapa 8c)

-- Query 1: Find policies by pattern matching in definition
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
WHERE
  qual LIKE '%scope_isolated%'
  OR with_check LIKE '%scope_isolated%'
ORDER BY tablename, policyname;

-- Query 2: Alternative using pg_get_expr (more reliable for complex policies)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE
  pg_get_expr(pol.polqual, pol.polrelid) LIKE '%scope_isolated%'
  OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%scope_isolated%'
  OR pg_get_expr(pol.polqual, pol.polrelid) IS NULL  -- Include policies with only WITH CHECK
ORDER BY n.nspname, c.relname, pol.polname;

-- Query 3: List ALL policies on key tables (for comparison)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('teams', 'workspaces', 'agent_sessions', 'messages', 'checkpoints', 'checkpoint_messages', 'team_connections')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
