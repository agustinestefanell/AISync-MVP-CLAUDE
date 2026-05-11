import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — registrar evento en audit_log (usado por Session Backup desde el cliente)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { workspaceId, event_type, metadata } = await req.json() as {
    workspaceId: string
    event_type: string
    metadata?: Record<string, unknown>
  }

  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id: workspaceId,
    event_type,
    metadata: metadata ?? null,
  })

  return Response.json({ ok: true })
}

// GET — leer los últimos eventos del audit_log de un workspace
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return Response.json({ error: 'workspaceId requerido' }, { status: 400 })

  const { data } = await supabase
    .from('audit_log')
    .select('id, event_type, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  return Response.json(data ?? [])
}
