import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceShell from '@/components/workspace/WorkspaceShell'
import AppLayout from '@/components/layout/AppLayout'
import type { Message } from '@/lib/db/types'

function teamIdToAccent(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 45%, 55%)`
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

  const team        = workspace.teams
  const pageName    = team?.name ?? 'Workspace'
  const accentColor = team ? teamIdToAccent(team.id) : undefined

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
