-- Chat-First Onboarding flag
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Agrega flag para tracking de onboarding completado. Usuarios nuevos (false)
-- son redirigidos a /start. Usuarios que completan onboarding o lo skipean
-- son marcados true y ven el dashboard normal.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

COMMENT ON COLUMN accounts.onboarding_completed IS
'Tracks whether user has completed Chat-First onboarding flow.
New users (false) are redirected to /start.
Users who complete onboarding or skip it are marked true.';
