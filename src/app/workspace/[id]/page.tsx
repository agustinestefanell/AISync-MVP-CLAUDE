import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceClient from '@/components/workspace/WorkspaceClient'
import { CORPORATE_PALETTES } from '@/lib/teams/getProjectColor'
import { getUserIsolatedTeamId } from '@/lib/db/connections'
import type { Message, HumanMessage } from '@/lib/db/types'

type MinimalTeam = { id: string; parent_id: string | null; created_at: string }

function computePaletteIndexForTeam(teamId: string, allTeams: MinimalTeam[]): number {
  const team = allTeams.find(t => t.id === teamId)
  if (!team || !team.parent_id) return 0

  const parent = allTeams.find(t => t.id === team.parent_id)
  if (!parent) return 0

  if (!parent.parent_id) {
    const siblings = allTeams
      .filter(t => t.parent_id === parent.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const pos = siblings.findIndex(t => t.id === teamId)
    return pos < 0 ? 1 : (pos + 1) % CORPORATE_PALETTES.length
  }

  return computePaletteIndexForTeam(team.parent_id, allTeams)
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { checkpoint?: string; prefill?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceWithAgents(params.id)
  if (!workspace) redirect('/')

  const entries = await Promise.all(
    workspace.agent_sessions.map(async session => {
      const msgs = await getMessages(session.id)
      return [session.id, msgs] as [string, Message[]]
    })
  )
  const initialMessages = Object.fromEntries(entries)

  const team = workspace.teams
  const pageName = team?.name ?? 'Workspace'

  // Read team.type from persisted data (single source of truth)
  const rawTeamType = team?.type
  if (!rawTeamType) {
    console.warn('[workspace/[id]/page] Missing teams.type for workspace/team', {
      workspaceId: workspace.id,
      teamId: team?.id,
    })
  }
  const teamType = rawTeamType === 'isolated' ? 'SAT' : (rawTeamType ?? undefined)

  let accentColor: string | undefined
  if (team?.project_id) {
    const { data: projectTeams } = await supabase
      .from('teams')
      .select('id, parent_id, created_at')
      .eq('project_id', team.project_id)

    if (projectTeams) {
      const paletteIndex = computePaletteIndexForTeam(team.id, projectTeams)
      accentColor = CORPORATE_PALETTES[paletteIndex].base
    }
  }

  // Check if this is an isolated team workspace
  let welcomeMetadata: {
    isHost: boolean
    connectionId: string
    requesterEmail: string
    requesterTeamName: string
    receiverEmail?: string
    receiverTeamName?: string
    description?: string
    color?: string
  } | undefined

  let connectionContext: {
    connectionId: string
    isHost: boolean
    otherUserEmail: string
    otherUserName?: string
    status: string
  } | undefined

  let initialHumanMessages: HumanMessage[] = []

  if (team?.type === 'isolated') {
    // Dual-read: query all three columns and let getUserIsolatedTeamId decide
    const { data: connections } = await supabase
      .from('team_connections')
      .select('id, requester_account_id, receiver_account_id, requester_email, requester_team_name, receiver_email, receiver_team_name, description, color, welcome_viewed_by_invitee, welcome_viewed_by_requester, status, host_isolated_team_id, invitee_isolated_team_id, scope_isolated_team_id')
      .or(`host_isolated_team_id.eq.${team.id},invitee_isolated_team_id.eq.${team.id},scope_isolated_team_id.eq.${team.id}`)
      .order('updated_at', { ascending: false })
      .limit(1)

    // Find the connection where the current team matches the user's side
    const connection = connections?.[0] && getUserIsolatedTeamId(connections[0], user.id) === team.id
      ? connections[0]
      : undefined

    if (connection) {
      const isHost = connection.requester_account_id === user.id
      const isInvitee = connection.receiver_account_id === user.id

      if (isHost || isInvitee) {
        // Connection context for human chat panel
        connectionContext = {
          connectionId: connection.id,
          isHost,
          otherUserEmail: isHost ? connection.receiver_email : connection.requester_email,
          otherUserName: isHost ? undefined : connection.requester_team_name,
          status: connection.status,
        }

        // Load human messages
        const { data: humanMsgs } = await supabase
          .from('human_messages')
          .select('*')
          .eq('connection_id', connection.id)
          .order('created_at', { ascending: true })

        initialHumanMessages = (humanMsgs as HumanMessage[]) ?? []

        // Welcome screen metadata (for invitee on first visit)
        if (isInvitee && !connection.welcome_viewed_by_invitee) {
          welcomeMetadata = {
            isHost: false,
            connectionId: connection.id,
            requesterEmail: connection.requester_email,
            requesterTeamName: connection.requester_team_name,
            description: connection.description ?? undefined,
            color: connection.color ?? undefined,
          }
        }

        // Welcome screen metadata (for host on first visit after invitee accepts)
        if (isHost && !connection.welcome_viewed_by_requester) {
          welcomeMetadata = {
            isHost: true,
            connectionId: connection.id,
            requesterEmail: connection.requester_email,
            requesterTeamName: connection.requester_team_name,
            receiverEmail: connection.receiver_email,
            receiverTeamName: connection.receiver_team_name ?? undefined,
            description: connection.description ?? undefined,
            color: connection.color ?? undefined,
          }
        }
      }
    }
  }

  return (
    <WorkspaceClient
      pageName={pageName}
      accentColor={accentColor}
      badge={teamType}
      workspace={workspace}
      initialMessages={initialMessages}
      initialCheckpointId={searchParams.checkpoint}
      prefillMessage={searchParams.prefill}
      userEmail={user.email ?? undefined}
      welcomeMetadata={welcomeMetadata}
      connectionContext={connectionContext}
      initialHumanMessages={initialHumanMessages}
      currentUserId={user.id}
    />
  )
}
