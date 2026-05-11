// CONTENT PLANE — Reads client-owned artifacts (checkpoints, checkpoint_messages).
// See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — recuperar todos los mensajes de un checkpoint (para Resume Work)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('checkpoint_messages')
    .select('session_id, role, content, position, agent_sessions(agent_role, provider, model)')
    .eq('checkpoint_id', params.id)
    .order('position', { ascending: true })

  return Response.json(data ?? [])
}
