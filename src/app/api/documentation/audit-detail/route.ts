import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/documentation/audit-detail?workspaceId=&teamId=&sessionIds=a,b,c&start=&end=
// Datos on-demand para el panel derecho de Audit View (Fase 2, Paso 3):
// - mensajes de chat dentro de la ventana [start, end] (cruzados por session_id
//   / timestamp, confirmado en la auditoría de factibilidad que esto requiere
//   query aparte — no viene de audit_log)
// - Context Files activos con scope Team/Session (NO Project — fuera del
//   alcance pedido para "Information used")
// - Prompts activos con scope Team/Worker (misma consulta que PromptLibrary.tsx)
// - Búsquedas web y adjuntos de esas sesiones en la ventana (históricos del
//   momento — OE Trazabilidad Parte 2, 2026-09-29; ver getTraceInWindow abajo)
// Explícitamente fuera: Model/Agent y Related object (decisión de producto,
// ver handoff-2026-07-b.md Fase 2 Paso 0).
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const params      = new URL(req.url).searchParams
  const workspaceId = params.get('workspaceId')
  const teamId       = params.get('teamId')
  const start        = params.get('start')
  const end          = params.get('end')
  const sessionIds   = (params.get('sessionIds') ?? '').split(',').filter(Boolean)

  if (!workspaceId || !start || !end) {
    return Response.json({ error: 'workspaceId, start and end are required.' }, { status: 400 })
  }

  const [messagesRes, contextFilesRes, promptsRes] = await Promise.all([
    sessionIds.length
      ? supabase
          .from('messages')
          .select('id, role, content, session_id, created_at, agent_sessions(agent_role)')
          .in('session_id', sessionIds)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),

    (teamId || sessionIds.length)
      ? supabase
          .from('context_sources')
          .select('id, title, scope')
          .eq('status', 'active')
          .or([
            teamId ? `and(scope.eq.team,team_id.eq.${teamId})` : null,
            sessionIds.length ? `and(scope.eq.session,session_id.in.(${sessionIds.join(',')}))` : null,
          ].filter(Boolean).join(','))
      : Promise.resolve({ data: [] as unknown[] }),

    (teamId || sessionIds.length)
      ? supabase
          .from('prompt_assignments')
          .select('prompt_id, assigned_to')
          .eq('is_active', true)
          .or([
            teamId ? `and(assigned_to.eq.team,target_id.eq.${teamId})` : null,
            sessionIds.length ? `and(assigned_to.eq.worker,target_id.in.(${sessionIds.join(',')}))` : null,
          ].filter(Boolean).join(','))
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const messages = ((messagesRes.data ?? []) as unknown as Array<{
    id: string
    role: string
    content: string
    session_id: string
    created_at: string
    agent_sessions: { agent_role: string } | null
  }>).map(m => ({
    id:         m.id,
    role:       m.role,
    content:    m.content,
    session_id: m.session_id,
    agent_role: m.agent_sessions?.agent_role ?? null,
    created_at: m.created_at,
  }))

  const contextFiles = ((contextFilesRes.data ?? []) as unknown as Array<{ id: string; title: string; scope: string }>)
    .map(c => ({ id: c.id, title: c.title, scope: c.scope }))

  const assignments = (promptsRes.data ?? []) as unknown as Array<{ prompt_id: string; assigned_to: string }>
  let prompts: { id: string; title: string; scope: string }[] = []
  if (assignments.length) {
    const promptIds = Array.from(new Set(assignments.map(a => a.prompt_id)))
    const { data: promptRows } = await supabase.from('prompt_library').select('id, title').in('id', promptIds)
    const titleMap = new Map(((promptRows ?? []) as { id: string; title: string }[]).map(p => [p.id, p.title]))
    prompts = assignments.map(a => ({
      id:    a.prompt_id,
      title: titleMap.get(a.prompt_id) ?? 'Untitled prompt',
      scope: a.assigned_to === 'team' ? 'team' : 'session',
    }))
  }

  // Búsquedas web y adjuntos de esas sesiones en la misma ventana [start, end]
  // (OE Trazabilidad, Parte 2). A diferencia de Context Files/Prompts, son
  // HISTÓRICOS del momento. Ventana por tiempo (no solo message_id) para que
  // entren también las búsquedas interrumpidas — la búsqueda es el objeto
  // principal (regla de huérfanas, AISyncPlans.md).
  const { webSearches, attachments } = await getTraceInWindow(supabase, sessionIds, start, end)

  return Response.json({ messages, contextFiles, prompts, webSearches, attachments })
}

type TraceClient = ReturnType<typeof createClient>

async function getTraceInWindow(supabase: TraceClient, sessionIds: string[], start: string, end: string) {
  if (!sessionIds.length) return { webSearches: [], attachments: [] }

  const [toolCallsRes, attachmentsRes] = await Promise.all([
    supabase
      .from('session_tool_calls')
      .select('id, query, status, message_id, cited_urls, sources, created_at')
      .in('session_id', sessionIds)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    supabase
      .from('session_attachments')
      .select('id, session_id, message_id, filename, attachment_type, size_bytes, created_at')
      .in('session_id', sessionIds)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
  ])

  const toolCalls = (toolCallsRes.data ?? []) as Array<{
    id: string; query: string | null; status: 'success' | 'error' | null; message_id: string | null
    cited_urls: string[] | null; sources: unknown[] | null; created_at: string
  }>

  // Qué respuestas existen — distingue "linked" de "interrupted".
  const messageIds = Array.from(new Set(toolCalls.map(t => t.message_id).filter((id): id is string => Boolean(id))))
  const { data: existing } = messageIds.length
    ? await supabase.from('messages').select('id').in('id', messageIds)
    : { data: [] as { id: string }[] }
  const existingIds = new Set(((existing ?? []) as { id: string }[]).map(m => m.id))

  const webSearches = toolCalls.map(t => ({
    id:           t.id,
    query:        t.query ?? '',
    created_at:   t.created_at,
    link_state:   t.status === 'error' ? 'failed'
                : !t.message_id ? 'legacy'
                : existingIds.has(t.message_id) || t.cited_urls !== null ? 'linked'
                : 'interrupted',
    cited_count:  t.cited_urls?.length ?? null,
    source_count: t.sources?.length ?? 0,
  }))

  // Duplicados legacy (pre-Parte 1, sin message_id): una fila por sesión +
  // archivo, igual que la pestaña Attached Files (decisión B de Agus).
  const seenLegacy = new Set<string>()
  const attachments = ((attachmentsRes.data ?? []) as Array<{
    id: string; session_id: string; message_id: string | null; filename: string
    attachment_type: 'image' | 'document'; size_bytes: number | null; created_at: string
  }>)
    .filter(a => {
      if (a.message_id) return true
      const key = `${a.session_id}|${a.filename}`
      if (seenLegacy.has(key)) return false
      seenLegacy.add(key)
      return true
    })
    .map(a => ({
      id:              a.id,
      filename:        a.filename,
      attachment_type: a.attachment_type,
      size_bytes:      a.size_bytes,
      created_at:      a.created_at,
      is_legacy:       !a.message_id,
    }))

  return { webSearches, attachments }
}
