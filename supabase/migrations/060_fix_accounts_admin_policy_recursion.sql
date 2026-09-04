-- Migration 060: Fix infinite recursion in "Admins read all accounts" RLS policy
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Cierra SEC-002 (AUDIT_REPORT.md, abierto 2026-06-11/12, diferido sin cerrar
-- hasta esta OE). La policy "Admins read all accounts" (012_admin_roles.sql)
-- hace un SELECT sobre `accounts` desde dentro de su propia policy de
-- `accounts` — Postgres dispara 42P17 ("infinite recursion detected in
-- policy for relation accounts") en CUALQUIER SELECT sobre la tabla bajo
-- sesión de usuario real (no solo en embeds/JOIN desde otra tabla — confirmado
-- con evidencia real 2026-09-04 contra la base de producción, ver
-- handoff-2026-07-c.md OE 2026-09-04).
--
-- Fix estándar de Supabase para este pitfall: mover el chequeo de rol a una
-- función SECURITY DEFINER, que evalúa el SELECT sobre `accounts` con
-- privilegios elevados (bypassa RLS en su propia ejecución interna) en vez de
-- disparar la policy recursivamente. Mismo patrón ya usado en este proyecto
-- en 026_vault_api_keys.sql (RPCs de Vault) y 027_active_project.sql
-- (set_active_project).
--
-- No se toca la policy "Users read own account" (auth.uid() = id) — no es
-- recursiva, sin cambios.

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = uid AND role IN ('owner', 'admin')
  )
$$;

DROP POLICY IF EXISTS "Admins read all accounts" ON accounts;

CREATE POLICY "Admins read all accounts" ON accounts
FOR SELECT USING (is_admin(auth.uid()));
