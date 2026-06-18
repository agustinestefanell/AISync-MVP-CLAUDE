// CONTENT PLANE — Writes to client-owned artifacts (checkpoints, checkpoint_messages).
// Also writes to audit_log (CONTROL PLANE) for operational traceability.
// See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'
import { logProvenanceEvent } from '@/lib/db/log-layers'

export const dynamic = 'force-dynamic'

// POST — crear checkpoint con todas las conversaciones actuales
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const { workspaceId, name, purpose, panels, humanMessages, connectionId } = await req.json() as {
    workspaceId: string
    name: string
    purpose: string
    panels: { sessionId: string; messages: { role: 'user' | 'assistant'; content: string }[] }[]
    humanMessages?: Array<{
      id: string
      connection_id: string
      from_account_id: string
      to_account_id: string
      content: string
      created_at: string
    }>
    connectionId?: string
  }

  // 1. Crear la cabecera del checkpoint
  const { data: checkpoint, error } = await supabase
    .from('checkpoints')
    .insert({ workspace_id: workspaceId, name, purpose })
    .select()
    .single()

  if (error || !checkpoint) {
    return Response.json({ error: error?.message ?? 'Error al crear checkpoint' }, { status: 500 })
  }

  // 2. Insertar mensajes del snapshot (flat, con position por sesión)
  const rows: Array<{
    checkpoint_id: string
    session_id?: string
    connection_id?: string
    message_type: 'agent' | 'human'
    role: 'user' | 'assistant'
    content: string
    position: number
  }> = panels.flatMap(({ sessionId, messages }) =>
    messages.map((m, i) => ({
      checkpoint_id: checkpoint.id,
      session_id:    sessionId,
      message_type:  'agent' as const,
      role:          m.role,
      content:       m.content,
      position:      i,
    }))
  )

  // 3. Add human messages if present (message_type: 'human')
  if (humanMessages && humanMessages.length > 0 && connectionId) {
    humanMessages.forEach((hm, i) => {
      const isFromMe = hm.from_account_id === user.id
      rows.push({
        checkpoint_id: checkpoint.id,
        connection_id: connectionId,
        message_type:  'human' as const,
        role:          isFromMe ? ('user' as const) : ('assistant' as const),
        content:       hm.content,
        position:      i,
      })
    })
  }

  if (rows.length > 0) {
    const { error: msgErr } = await supabase.from('checkpoint_messages').insert(rows)
    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 })
  }

  // 3. Provenance log (Capa 3)
  logProvenanceEvent({
    object_id:   checkpoint.id,
    object_type: 'checkpoint',
    event_type:  'object.created',
    agent_type:  'user',
    agent_id:    user.id,
    payload:     { name: checkpoint.name, workspace_id: workspaceId },
  })

  // 4. Audit log (Capa 1)
  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id: workspaceId,
    event_type:   'save_version',
    metadata:     { checkpoint_id: checkpoint.id, name, purpose, message_count: rows.length },
  })

  return Response.json({ checkpoint })
}

// GET — listar checkpoints de un workspace
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return Response.json({ error: 'workspaceId is required.' }, { status: 400 })

  const { data } = await supabase
    .from('checkpoints')
    .select('id, name, purpose, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}
