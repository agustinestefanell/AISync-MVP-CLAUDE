import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveProjectId, getTeamsForProject } from '@/lib/db/teams'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import TeamsClient from '@/components/teams/TeamsClient'
import AppLayout from '@/components/layout/AppLayout'

export default async function TeamsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = await getActiveProjectId()
  if (!projectId) redirect('/')

  const [projects, teams] = await Promise.all([
    getProjectsWithHierarchy(),
    getTeamsForProject(projectId),
  ])

  const activeProject = projects.find(p => p.id === projectId)

  return (
    <AppLayout
      pageName="TEAMS MAP"
      pageSubtitle="How to use Teams Map (click here)"
      projectName={activeProject?.name}
      scrollable={false}
    >
      <TeamsClient projectId={projectId} initialTeams={teams} />
    </AppLayout>
  )
}
