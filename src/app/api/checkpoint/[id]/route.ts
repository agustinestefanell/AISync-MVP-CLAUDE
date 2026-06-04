// CONTENT PLANE — Reads client-owned artifacts (checkpoints, checkpoint_messages).
// See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — recuperar todos los mensajes de un checkpoint (para Resume Work)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { data: checkpoint } = await supabase
    .from('checkpoints')
    .select('id, workspaces(team_id, teams(project_id, projects(account_id)))')
    .eq('id', params.id)
    .single()

  if (!checkpoint) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  type OwnershipChain = { workspaces?: { teams?: { projects?: { account_id?: string } | null } | null } | null }
  const project = (checkpoint as unknown as OwnershipChain).workspaces?.teams?.projects

  if (!project || project.account_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase
    .from('checkpoint_messages')
    .select('session_id, role, content, position, agent_sessions(agent_role, provider, model)')
    .eq('checkpoint_id', params.id)
    .order('position', { ascending: true })

  return Response.json(data ?? [])
}
