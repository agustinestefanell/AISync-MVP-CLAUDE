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

  return Response.json({ messages, contextFiles, prompts })
}
