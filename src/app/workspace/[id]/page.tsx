import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceShell from '@/components/workspace/WorkspaceShell'
import AppLayout from '@/components/layout/AppLayout'
import type { Message } from '@/lib/db/types'

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

  return (
    <AppLayout
      pageName="MAIN WORKSPACE"
      pageSubtitle="How to use Main Workspace (click here)"
      scrollable={false}
    >
      <WorkspaceShell
        workspace={workspace}
        initialMessages={initialMessages}
        initialCheckpointId={searchParams.checkpoint}
      />
    </AppLayout>
  )
}
