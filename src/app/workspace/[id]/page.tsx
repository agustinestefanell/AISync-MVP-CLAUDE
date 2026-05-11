import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getWorkspaceWithAgents } from '@/lib/db/workspaces'
import { getMessages } from '@/lib/db/messages'
import WorkspaceShell from '@/components/workspace/WorkspaceShell'
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
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      <header className="shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-400 text-sm">{workspace.name}</span>
        <Link
          href="/audit"
          className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Audit Log →
        </Link>
      </header>
      <WorkspaceShell
        workspace={workspace}
        initialMessages={initialMessages}
        initialCheckpointId={searchParams.checkpoint}
      />
    </div>
  )
}
