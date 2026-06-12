-- Active project persistence for multi-project switching (ARC-004).
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Agrega accounts.active_project_id y la RPC set_active_project con ownership
-- check. La lectura vive en getActiveProjectId() (src/lib/db/teams.ts), que
-- valida la selección y cae al primer proyecto activo si es null/borrada/inactiva.
--
-- Nota: la lectura de accounts.active_project_id con cliente de usuario depende
-- de la política "Users read own account" (012). Si el switch nunca persiste,
-- probablemente esté activa la recursión RLS sospechada en SEC-002 — verificar.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS active_project_id uuid
  REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_active_project(
  p_project_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'projectId is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = p_project_id
      AND account_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Project not found or unauthorized.';
  END IF;

  UPDATE public.accounts
  SET active_project_id = p_project_id
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_project(uuid) TO authenticated;
