-- Migration 033: Add status column to projects for archive functionality
-- Date: 2026-06-15
-- Description: Allow projects to be archived (soft delete) while maintaining data integrity

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

-- Index for filtering active projects (common query)
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

COMMENT ON COLUMN public.projects.status IS 'Project status: active (visible in dashboard) or archived (hidden but recoverable)';
