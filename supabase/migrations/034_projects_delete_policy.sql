-- Migration 034: Add DELETE policy for projects table
-- Date: 2026-06-15
-- Description: Allow project owners to delete their own projects

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (account_id = auth.uid());

COMMENT ON POLICY "projects_delete" ON public.projects IS 'Users can only delete their own projects';
