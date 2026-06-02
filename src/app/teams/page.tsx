import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveProjectId } from '@/lib/db/teams'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import TeamsClient from '@/components/teams/TeamsClient'
import type { TeamWithWorkspaces } from '@/lib/db/types'

export default async function TeamsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = await getActiveProjectId()
  if (!projectId) redirect('/')

  const projects = await getProjectsWithHierarchy()

  // All projects in a single map; active project is highlighted.
  const allTeams = projects.flatMap(p => p.teams as TeamWithWorkspaces[])
  const activeProject = projects.find(p => p.id === projectId)

  return (
    <TeamsClient
      pageName="TEAMS MAP"
      projectName={activeProject?.name}
      projectId={projectId}
      initialTeams={allTeams}
    />
  )
}
