import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getActiveProjectId } from '@/lib/db/teams'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import TeamsClient from '@/components/teams/TeamsClient'
import type { TeamWithWorkspaces } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface IsolatedConnectionRow {
  invitee_isolated_team_id: string | null
  description: string | null
  color: string | null
  invitee_team: TeamWithWorkspaces | null
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
      invitee_isolated_team_id,
      description,
      color,
      invitee_team:invitee_isolated_team_id (
        *,
        workspaces (
          *,
          agent_sessions (*)
        )
      )
    `)
    .eq('receiver_account_id', user.id)
    .eq('status', 'active')
    .not('invitee_isolated_team_id', 'is', null)

  const isolatedTeams = (isolatedConnections as IsolatedConnectionRow[] | null ?? [])
    .map(c => {
      const team = c.invitee_team
      if (!team) return null

      // Ensure color and description are present (copied at accept, but fallback to connection for safety)
      return {
        ...team,
        color: team.color ?? c.color ?? null,
        description: team.description ?? c.description ?? null,
      } as TeamWithWorkspaces
    })
    .filter((t): t is TeamWithWorkspaces => t != null)

  // All projects in a single map; active project is highlighted.
  // Include isolated teams for invitee via team_connections
  // Deduplicate by team.id (isolated teams may appear in both projects and isolatedTeams)
  const allTeamsRaw = [
    ...projects.flatMap(p => p.teams as TeamWithWorkspaces[]),
    ...isolatedTeams
  ]
  const allTeams = Array.from(
    new Map(allTeamsRaw.map(t => [t.id, t])).values()
  )
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
