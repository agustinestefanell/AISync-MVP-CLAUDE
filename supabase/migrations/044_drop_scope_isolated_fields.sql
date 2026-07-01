-- Migración 044: Eliminar scope_isolated_team_id y scope_isolated_workspace_id (campos legacy)
-- Contexto: Connected Teams Etapa 8c — eliminación física de campos tras limpieza de código en Etapa 8b
-- Fecha: 2026-06-30
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ══════════════════════════════════════════════════════════════════════════════
-- PREREQUISITOS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- 1. Etapa 8b completada (todas las referencias en código TypeScript eliminadas)
--    Verificar con: grep -rn "scope_isolated" src/ (debe devolver 0 resultados)
--
-- 2. Políticas de ownership normales (migración 001) cubren correctamente a ambos usuarios:
--    - teams_select: verifica p.account_id = auth.uid() a través de projects
--    - workspaces_select: verifica p.account_id = auth.uid() a través de teams → projects
--    - agent_sessions_select: verifica p.account_id = auth.uid() a través de workspaces → teams → projects
--
-- 3. Modelo de dos edificios validado en producción (Etapas 0-5):
--    - Host: dueño de su proyecto → acceso por ownership normal
--    - Invitee: dueño de su proyecto → acceso por ownership normal
--    - Las políticas legacy basadas en team_connections.scope_isolated_team_id son redundantes

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. DROP POLÍTICAS RLS LEGACY
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Estas tres políticas fueron creadas para el modelo de edificio compartido (pre-Etapa 2).
-- Con el modelo de dos edificios, cada usuario accede a sus propios recursos por ownership
-- directo (p.account_id = auth.uid()), haciendo estas políticas redundantes.
--
-- Referencia: DECISIONS.md 2026-06-26, handoff-2026-07.md Etapa 8c

-- Política en teams (no versionada en migraciones, creada manualmente)
DROP POLICY IF EXISTS "Invitee can read isolated team" ON public.teams;

-- Políticas en workspaces y agent_sessions (de migración 028)
DROP POLICY IF EXISTS "Invitee can read isolated workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Invitee can read isolated agent_sessions" ON public.agent_sessions;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. DROP COLUMNAS DE team_connections
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Orden: primero scope_isolated_team_id (tiene FK a teams), luego scope_isolated_workspace_id

ALTER TABLE public.team_connections
  DROP COLUMN IF EXISTS scope_isolated_team_id;

ALTER TABLE public.team_connections
  DROP COLUMN IF EXISTS scope_isolated_workspace_id;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. ACTUALIZAR COMENTARIO DE TABLA
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public.team_connections IS
  'Cross-account team connections. Architecture: two separate buildings (host + invitee), each with own team/workspace/manager. Legacy scope_isolated_* fields removed in migration 044 (2026-06-30).';

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Query 1: Confirmar que las columnas fueron eliminadas
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'team_connections'
--   AND column_name IN ('scope_isolated_team_id', 'scope_isolated_workspace_id');
-- Resultado esperado: 0 filas
--
-- Query 2: Confirmar que las políticas fueron eliminadas
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE policyname IN (
--   'Invitee can read isolated team',
--   'Invitee can read isolated workspace',
--   'Invitee can read isolated agent_sessions'
-- );
-- Resultado esperado: 0 filas
--
-- Query 3: Verificar que las políticas de ownership normales siguen activas
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE policyname IN (
--   'teams_select',
--   'workspaces_select',
--   'agent_sessions_select'
-- )
-- ORDER BY tablename;
-- Resultado esperado: 3 filas (una por tabla)
