// GET checkpoint detail (full messages) for Documentation Mode panel
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('checkpoint_messages')
    .select('role, content, position, session_id, agent_sessions(agent_role)')
    .eq('checkpoint_id', params.id)
    .order('position', { ascending: true })

  const messages = ((data ?? []) as unknown as Array<{
    role: string
    content: string
    position: number
    session_id: string | null
    agent_sessions: { agent_role: string } | null
  }>).map(m => ({
    role:       m.role,
    content:    m.content,
    position:   m.position,
    agent_role: m.agent_sessions?.agent_role ?? undefined,
  }))

  return Response.json(messages)
}
