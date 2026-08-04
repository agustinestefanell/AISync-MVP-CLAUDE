// GET listing (metadata + short preview) of Handoff Packages, Saved Selections,
// and Checkpoints for the "Load Saved Context" picker in Workspace.
// Wraps the same server-only functions documentation/page.tsx already uses,
// unmodified — this route only exposes them to a client component.
import { createClient } from '@/lib/supabase/server'
import { getDocCheckpoints, getHandoffPackages, getSavedSelections } from '@/lib/db/documentation'
import { getProjectsWithHierarchy } from '@/lib/db/projects'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [checkpoints, handoffPackages, savedSelections, projects] = await Promise.all([
    getDocCheckpoints(),
    getHandoffPackages(),
    getSavedSelections(user.id),
    getProjectsWithHierarchy(),
  ])

  return Response.json({
    checkpoints,
    handoffPackages,
    savedSelections,
    projects: projects.map(p => ({ id: p.id, name: p.name })),
  })
}
