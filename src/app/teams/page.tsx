import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getActiveProjectId } from '@/lib/db/teams'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import TeamsClient from '@/components/teams/TeamsClient'
import type { TeamWithWorkspaces } from '@/lib/db/types'

interface IsolatedConnectionRow {
  scope_isolated_team_id: string | null
  description: string | null
  color: string | null
  scope_isolated_workspace_id: string | null
  isolated_team: TeamWithWorkspaces | null
}

export default async function TeamsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = await getActiveProjectId()
  if (!projectId) redirect('/')

  const projects = await getProjectsWithHierarchy()

  // Fetch isolated teams where user is receiver (invitee)
  const supabaseAdmin = createAdminClient()
  const { data: isolatedConnections } = await supabaseAdmin
    .from('team_connections')
    .select(`
      scope_isolated_team_id,
      description,
      color,
      scope_isolated_workspace_id,
      isolated_team:scope_isolated_team_id (
        *,
        workspaces (
          *,
          agent_sessions (*)
        )
      )
    `)
    .eq('receiver_account_id', user.id)
    .eq('status', 'active')
    .not('scope_isolated_team_id', 'is', null)

  const isolatedTeams = (isolatedConnections as IsolatedConnectionRow[] | null ?? [])
    .map(c => {
      if (!c.isolated_team) return null
      // Ensure color and description are present (copied at accept, but fallback to connection for safety)
      const team = c.isolated_team

      // DEBUG: Log isolated team data from query
      console.log('[teams/page] Isolated team from query:', {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        connectionColor: c.color,
        finalColor: team.color ?? c.color ?? null,
      })

      return {
        ...team,
        color: team.color ?? c.color ?? null,
        description: team.description ?? c.description ?? null,
      } as TeamWithWorkspaces
    })
    .filter((t): t is TeamWithWorkspaces => t != null)

  // All projects in a single map; active project is highlighted.
  // Include isolated teams for invitee via team_connections
  const allTeams = [
    ...projects.flatMap(p => p.teams as TeamWithWorkspaces[]),
    ...isolatedTeams
  ]
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
