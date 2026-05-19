import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceShell from '@/components/workspace/WorkspaceShell'
import AppLayout from '@/components/layout/AppLayout'
import { CORPORATE_PALETTES } from '@/lib/teams/getProjectColor'
import type { Message } from '@/lib/db/types'

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
  searchParams: { checkpoint?: string }
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

  return (
    <AppLayout
      pageName={pageName}
      pageSubtitle="How to use Main Workspace (click here)"
      scrollable={false}
      accentColor={accentColor}
    >
      <WorkspaceShell
        workspace={workspace}
        initialMessages={initialMessages}
        initialCheckpointId={searchParams.checkpoint}
      />
    </AppLayout>
  )
}
