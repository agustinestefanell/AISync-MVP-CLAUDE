-- Migration 061: Add sort_order to projects for manual drag & drop reordering
-- Date: 2026-09-15
-- Description: Projects today order by created_at ASC with no manual
-- override (Teams Map sidebar, dashboard, and the "active project" fallback
-- all read that same order). This adds projects.sort_order so the user can
-- drag & drop to reorder Projects in Teams Map.
--
-- No hace falta tabla de preferencias separada: sort_order va directo en
-- projects porque RLS ya garantiza que un Project nunca es visible para otra
-- cuenta (projects_select: account_id = auth.uid()), así que no hay riesgo de
-- que el orden de un usuario se mezcle con el de otro.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- Backfill: asigna sort_order secuencial por cuenta, respetando el orden
-- created_at ASC de hoy — el orden visual no cambia para nadie en el momento
-- en que se aplica esta migración.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY created_at ASC) AS rn
  FROM public.projects
)
UPDATE public.projects p
SET sort_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

ALTER TABLE public.projects
  ALTER COLUMN sort_order SET NOT NULL;

-- Índice para el ORDER BY sort_order filtrado por cuenta (mismo patrón de
-- acceso que hoy usa created_at: siempre account_id + status + orden).
CREATE INDEX IF NOT EXISTS idx_projects_account_sort_order
  ON public.projects(account_id, sort_order);

-- Trigger: todo INSERT que no traiga sort_order explícito recibe
-- max(sort_order de la cuenta) + 1. Evita tener que tocar cada call site que
-- hoy inserta en projects (POST /api/projects, createProject,
-- createDemoProject, onboarding/start) para que sigan funcionando sin
-- cambios y el proyecto nuevo aparezca siempre al final.
CREATE OR REPLACE FUNCTION public.set_project_sort_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO NEW.sort_order
    FROM public.projects
    WHERE account_id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_set_sort_order ON public.projects;

CREATE TRIGGER trg_projects_set_sort_order
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_sort_order();

COMMENT ON COLUMN public.projects.sort_order IS 'Manual display order within account_id (drag & drop reorder in Teams Map sidebar). Lower = earlier. Not globally unique, only unique in intent per account.';
