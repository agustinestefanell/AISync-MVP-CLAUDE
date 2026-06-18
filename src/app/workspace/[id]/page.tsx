import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceClient from '@/components/workspace/WorkspaceClient'
import { CORPORATE_PALETTES } from '@/lib/teams/getProjectColor'
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
  const teamType = new Set(workspace.agent_sessions.map(s => s.provider)).size === 1 ? 'SAT' : 'MAT'

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
    connectionId: string
    requesterEmail: string
    requesterTeamName: string
    description?: string
    color?: string
  } | undefined

  let connectionContext: {
    connectionId: string
    isHost: boolean
    otherUserEmail: string
    otherUserName?: string
  } | undefined

  let initialHumanMessages: HumanMessage[] = []

  if (team?.type === 'isolated') {
    const { data: connection } = await supabase
      .from('team_connections')
      .select('id, requester_account_id, receiver_account_id, requester_email, requester_team_name, receiver_email, description, color, welcome_viewed_by_invitee, status')
      .eq('scope_isolated_team_id', team.id)
      .eq('status', 'active')
      .single()

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
        }

        // Load human messages
        const { data: humanMsgs } = await supabase
          .from('human_messages')
          .select('*')
          .eq('connection_id', connection.id)
          .order('created_at', { ascending: true })

        initialHumanMessages = (humanMsgs as HumanMessage[]) ?? []

        // Welcome screen metadata (only for invitee on first visit)
        if (isInvitee && !connection.welcome_viewed_by_invitee) {
          welcomeMetadata = {
            connectionId: connection.id,
            requesterEmail: connection.requester_email,
            requesterTeamName: connection.requester_team_name,
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
