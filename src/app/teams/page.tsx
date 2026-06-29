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
  scope_isolated_team_id: string | null
  description: string | null
  color: string | null
  scope_isolated_workspace_id: string | null
  invitee_team: TeamWithWorkspaces | null
  legacy_team: TeamWithWorkspaces | null
}

export default async function TeamsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = await getActiveProjectId()
  if (!projectId) redirect('/')

  const projects = await getProjectsWithHierarchy()

  // Fetch isolated teams where user is receiver (invitee)
  // Dual-read: fetch both new and legacy fields with separate joins
  const supabaseAdmin = createAdminClient()
  const { data: isolatedConnections } = await supabaseAdmin
    .from('team_connections')
    .select(`
      invitee_isolated_team_id,
      scope_isolated_team_id,
      description,
      color,
      scope_isolated_workspace_id,
      invitee_team:invitee_isolated_team_id (
        *,
        workspaces (
          *,
          agent_sessions (*)
        )
      ),
      legacy_team:scope_isolated_team_id (
        *,
        workspaces (
          *,
          agent_sessions (*)
        )
      )
    `)
    .eq('receiver_account_id', user.id)
    .eq('status', 'active')
    .or('invitee_isolated_team_id.not.is.null,scope_isolated_team_id.not.is.null')

  const isolatedTeams = (isolatedConnections as IsolatedConnectionRow[] | null ?? [])
    .map(c => {
      // Dual-read: prefer invitee_team (new arch), fall back to legacy_team
      const team = c.invitee_team ?? c.legacy_team
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
  const allTeams = [
    ...projects.flatMap(p => p.teams as TeamWithWorkspaces[]),
    ...isolatedTeams
  ]
  const activeProject = projects.find(p => p.id === projectId)

  // TEMPORAL DEBUG LOG — investigación Connected Teams
  console.log('=== TEAMS PAGE DEBUG ===')
  console.log('user.id:', user.id)
  console.log('user.email:', user.email)
  console.log('allTeams count:', allTeams.length)
  console.log('allTeams details:', allTeams.map(t => ({
    team_id: t.id,
    team_name: t.name,
    team_type: t.type,
    workspace_id: t.workspaces?.[0]?.id ?? 'NO_WORKSPACE',
    workspace_name: t.workspaces?.[0]?.name ?? 'NO_WORKSPACE',
  })))
  console.log('projects.flatMap teams:', projects.flatMap(p => p.teams as TeamWithWorkspaces[]).map(t => ({
    team_id: t.id,
    team_name: t.name,
    source: 'projects.flatMap'
  })))
  console.log('isolatedTeams:', isolatedTeams.map(t => ({
    team_id: t.id,
    team_name: t.name,
    source: 'isolatedTeams (from connections)'
  })))
  console.log('========================')

  return (
    <TeamsClient
      pageName="TEAMS MAP"
      projectName={activeProject?.name}
      projectId={projectId}
      initialTeams={allTeams}
    />
  )
}
