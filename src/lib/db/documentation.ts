// CONTENT PLANE — These queries operate on client-owned artifacts.
// Data is currently stored in platform infrastructure but must be
// treated as migratable client property. See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'
import { stripMarkdown } from '@/lib/text/stripMarkdown'

export interface DocCheckpoint {
  id: string
  name: string
  purpose: string
  doc_state: string
  object_type: string
  sensitivity: string
  version_label: string
  responsible: string | null
  workspace_id: string
  workspace_name: string
  team_id: string
  team_name: string
  team_type: string
  team_status: 'active' | 'archived' | null
  project_id:       string
  project_name:     string
  created_at:          string
  content_preview?:    string
  message_count:       number
  // checkpoint_messages removed from list interface — fetch individual detail with getCheckpointDetail()
}

export interface DocAuditEvent {
  id: string
  event_type: string
  workspace_id: string | null
  workspace_name: string | null
  team_id: string | null
  team_name: string | null
  team_status: 'active' | 'archived' | null
  project_id: string | null
  project_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  account_name: string | null
  account_email: string | null
  // Ver comentario equivalente en src/lib/db/audit.ts (getAuditEvents) —
  // mismo mecanismo de lookup vía message_provenance (migración 055).
  forwarded_content: string | null
}

interface RawCheckpoint {
  id: string
  name: string
  purpose: string
  doc_state: string | null
  object_type: string | null
  sensitivity: string | null
  version_label: string | null
  responsible: string | null
  workspace_id: string
  created_at: string
  checkpoint_messages: { content: string; role: string; position: number; session_id: string | null; agent_sessions: { agent_role: string } | null }[] | null
  workspaces: {
    id: string
    name: string
    teams: {
      id: string
      name: string
      type: string
      status: string | null
      projects: { id: string; name: string } | null
    } | null
  } | null
}

export async function getDocCheckpoints(): Promise<DocCheckpoint[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('checkpoints')
    .select(`
      id, name, purpose,
      doc_state, object_type, sensitivity, version_label, responsible,
      workspace_id, created_at,
      checkpoint_messages(content, role, position),
      workspaces (
        id, name,
        teams (
          id, name, type, status,
          projects (id, name)
        )
      )
    `)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawCheckpoint[]).map(r => ({
    id:             r.id,
    name:           r.name,
    purpose:        r.purpose ?? 'Checkpoint',
    doc_state:      r.doc_state  ?? 'active',
    object_type:    r.object_type ?? 'checkpoint',
    sensitivity:    r.sensitivity ?? 'internal',
    version_label:  r.version_label ?? 'v1',
    responsible:    r.responsible ?? null,
    workspace_id:   r.workspace_id,
    workspace_name: r.workspaces?.name ?? '—',
    team_id:        r.workspaces?.teams?.id ?? '',
    team_name:      r.workspaces?.teams?.name ?? '—',
    team_type:      r.workspaces?.teams?.type ?? 'SAT',
    team_status:    (r.workspaces?.teams?.status as 'active' | 'archived' | null) ?? null,
    project_id:      r.workspaces?.teams?.projects?.id ?? '',
    project_name:    r.workspaces?.teams?.projects?.name ?? '—',
    created_at:      r.created_at,
    message_count:   Array.isArray(r.checkpoint_messages) ? r.checkpoint_messages.length : 0,
    content_preview: (() => {
      const msgs = Array.isArray(r.checkpoint_messages) ? r.checkpoint_messages : []
      const assistantMsgs = msgs.filter(m => m.role === 'assistant')
      const sorted = [...assistantMsgs].sort((a, b) => a.position - b.position)
      const last = sorted[sorted.length - 1]
      if (!last) return undefined
      const content = last.content ?? ''
      return content.length > 0 ? stripMarkdown(content, 200) : undefined
    })(),
    // checkpoint_messages array NOT returned — use getCheckpointDetail(id) to fetch full content
  }))
}

// Fetch full checkpoint detail with all messages (for panel detalle)
export async function getCheckpointDetail(checkpointId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('checkpoint_messages')
    .select('role, content, position, session_id, agent_sessions(agent_role)')
    .eq('checkpoint_id', checkpointId)
    .order('position', { ascending: true })

  return ((data ?? []) as unknown as Array<{
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
}

export interface DocHandoffPackage {
  id: string
  name: string
  from_agent: string
  to_agent: string
  status: string
  context: string | null
  workspace_id: string
  workspace_name: string
  team_id: string | null
  team_name: string | null
  team_status: 'active' | 'archived' | null
  project_id: string | null
  project_name: string | null
  message_count:    number
  content_preview?: string
  created_at:       string
  // messages removed from list interface — fetch with getHandoffDetail(id)
}

interface RawHandoffPackage {
  id: string
  name: string
  from_agent: string
  to_agent: string
  status: string
  context: string | null
  messages: unknown[]
  workspace_id: string
  created_at: string
  workspaces: {
    name: string
    teams: { id: string; name: string; status: string | null; projects: { id: string; name: string } | null } | null
  } | null
}

export async function getHandoffPackages(): Promise<DocHandoffPackage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('handoff_packages')
    .select('id, name, from_agent, to_agent, status, context, messages, workspace_id, created_at, workspaces(name, teams(id, name, status, projects(id, name)))')
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawHandoffPackage[]).map(r => {
    const team    = Array.isArray(r.workspaces?.teams) ? r.workspaces?.teams[0] : r.workspaces?.teams
    const project = Array.isArray(team?.projects)      ? team?.projects[0]      : team?.projects
    return {
      id:             r.id,
      name:           r.name,
      from_agent:     r.from_agent,
      to_agent:       r.to_agent,
      status:         r.status,
      context:        r.context ?? null,
      workspace_id:   r.workspace_id,
      workspace_name: r.workspaces?.name ?? '—',
      team_id:        team?.id        ?? null,
      team_name:      team?.name      ?? null,
      team_status:    (team?.status as 'active' | 'archived' | null) ?? null,
      project_id:     project?.id     ?? null,
      project_name:   project?.name   ?? null,
      message_count:   Array.isArray(r.messages) ? r.messages.length : 0,
      content_preview: (() => {
        const msgs = Array.isArray(r.messages) ? r.messages : []
        const last = msgs[msgs.length - 1] as Record<string, unknown> | undefined
        if (!last) return undefined
        const content = last.content ?? last.text ?? last.message ?? ''
        return typeof content === 'string' && content.length > 0
          ? stripMarkdown(content, 200)
          : undefined
      })(),
      created_at:      r.created_at,
      // messages array NOT returned — use getHandoffDetail(id) to fetch full content
    }
  })
}

// Fetch full handoff package detail with all messages (for panel detalle)
export async function getHandoffDetail(handoffId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('handoff_packages')
    .select('messages')
    .eq('id', handoffId)
    .single()

  if (!data) return []

  const messages = Array.isArray(data.messages) ? data.messages : []
  return (messages as Record<string, unknown>[]).map(m => ({
    role:    typeof m.role    === 'string' ? m.role    : 'user',
    content: typeof m.content === 'string' ? m.content : '',
  }))
}

export interface DocSavedSelection {
  id:             string
  name:           string
  message_count:  number
  content_preview?: string
  workspace_id:   string
  workspace_name: string
  team_id:        string | null
  team_name:      string | null
  team_status:    'active' | 'archived' | null
  project_id:     string | null
  project_name:   string | null
  created_at:     string
  user_id:        string
  // Tags de User Library (migración 058, 2026-08-21) — [] si no está en la library.
  tags:           { id: string; name: string }[]
  // messages removed from list interface — fetch with getSavedSelectionDetail(id)
}

interface RawSavedSelection {
  id:           string
  name:         string
  messages:     unknown[]
  workspace_id: string
  team_id:      string | null
  project_id:   string | null
  created_at:   string
  user_id:      string
  workspaces: {
    name: string
    teams: { id: string; name: string; status: string | null; projects: { id: string; name: string } | null } | null
  } | null
  saved_selection_tags: { tags: { id: string; name: string } | null }[] | null
}

export async function getSavedSelections(userId: string): Promise<DocSavedSelection[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('saved_selections')
    .select('id, name, messages, workspace_id, team_id, project_id, created_at, user_id, workspaces(name, teams(id, name, status, projects(id, name))), saved_selection_tags(tags(id, name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawSavedSelection[]).map(r => {
    const team    = Array.isArray(r.workspaces?.teams) ? r.workspaces?.teams[0] : r.workspaces?.teams
    const project = Array.isArray(team?.projects)      ? team?.projects[0]      : team?.projects
    const messages = Array.isArray(r.messages) ? r.messages : []
    const last = messages[messages.length - 1] as Record<string, unknown> | undefined
    const content = last?.content ?? last?.text ?? last?.message ?? ''

    return {
      id:             r.id,
      name:           r.name,
      message_count:  messages.length,
      content_preview: typeof content === 'string' && content.length > 0
        ? stripMarkdown(content, 200)
        : undefined,
      workspace_id:   r.workspace_id,
      workspace_name: r.workspaces?.name ?? '—',
      team_id:        r.team_id ?? null,
      team_name:      team?.name ?? null,
      team_status:    (team?.status as 'active' | 'archived' | null) ?? null,
      // project_id resuelto vía JOIN (workspace → team → project), NO la columna
      // propia de saved_selections — esa columna es siempre NULL en la práctica
      // (WorkspaceShell.tsx handleSaveSelection envía `project_id: null` hardcodeado
      // al crear la selección), lo que hacía desaparecer todo Save Selection al
      // filtrar por Project en Repository View / Investigate View / Audit View.
      // Mismo patrón ya usado por getHandoffPackages()/getDocCheckpoints().
      project_id:     project?.id ?? null,
      project_name:   project?.name ?? null,
      created_at:     r.created_at,
      user_id:        r.user_id,
      tags:           (r.saved_selection_tags ?? []).map(t => t.tags).filter((t): t is { id: string; name: string } => !!t),
      // messages array NOT returned — use getSavedSelectionDetail(id) to fetch full content
    }
  })
}

// ── User Library (2026-08-21) — reemplaza Structure View como tab de
// Documentation Mode. Basada únicamente en Save Selection + tags manuales
// libres (migración 058). "Estar en la library" se deriva de tener al menos
// 1 tag (saved_selection_tags) — no hay columna in_user_library, ver
// DECISIONS.md 2026-08-21.
export interface DocTag {
  id:   string
  name: string
}

export async function getTags(): Promise<DocTag[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name')
    .order('name', { ascending: true })

  return (data ?? []) as DocTag[]
}

// Fetch full saved selection detail with all messages (for panel detalle)
export async function getSavedSelectionDetail(selectionId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('saved_selections')
    .select('messages')
    .eq('id', selectionId)
    .single()

  if (!data) return []

  const messages = Array.isArray(data.messages) ? data.messages : []
  return messages as { role?: string; content?: string; agent_role?: string }[]
}

// review_forward hacia un agente (Agente↔Agente y Humano→Agente) deja una fila
// en message_provenance con source_object_id = audit_log.id. La variante hacia
// human_chat NO la tiene (destino human_messages, sin FK posible — migración 055).
async function getForwardedContentMap(
  supabase: ReturnType<typeof createClient>,
  eventIds: string[]
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map()
  const { data } = await supabase
    .from('message_provenance')
    .select('source_object_id, messages(content)')
    .eq('source_object_type', 'review_forward')
    .in('source_object_id', eventIds)

  const map = new Map<string, string>()
  for (const row of (data ?? []) as unknown as Array<{ source_object_id: string; messages: { content: string } | null }>) {
    if (row.messages?.content) map.set(row.source_object_id, row.messages.content)
  }
  return map
}

export async function getDocAuditEvents(): Promise<DocAuditEvent[]> {
  const supabase = createClient()
  // Sin .limit() — Audit View (Fase 2, 2026-08-19) necesita el historial completo
  // para reconstruir Prior steps/Downstream uses, no solo los últimos N para mostrar.
  // Volumen real medido 2026-08-19: 586 filas totales, crecimiento ~200/mes — trivial.
  const { data } = await supabase
    .from('audit_log')
    .select(`
      id, event_type, workspace_id, metadata, created_at,
      workspaces (name, teams (id, name, status, projects (id, name))),
      accounts (name, email)
    `)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as Array<{
    id: string
    event_type: string
    workspace_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    workspaces: { name: string; teams: { id: string; name: string; status: string | null; projects: { id: string; name: string } | null } | null } | null
    accounts: { name: string | null; email: string | null } | null
  }>

  const forwardIds = rows.filter(r => r.event_type === 'review_forward').map(r => r.id)
  const contentMap = await getForwardedContentMap(supabase, forwardIds)

  return rows.map(r => {
    // For events without workspace (e.g. connection_accepted), extract team info from metadata if available
    const teamId = r.workspaces?.teams?.id ?? null
    const teamName = r.workspaces?.teams?.name ?? (r.metadata?.requester_team_name as string | null | undefined) ?? null
    const teamStatus = (r.workspaces?.teams?.status as 'active' | 'archived' | null) ?? null

    return {
      id:                r.id,
      event_type:        r.event_type,
      workspace_id:      r.workspace_id,
      workspace_name:    r.workspaces?.name ?? null,
      team_id:           teamId,
      team_name:         teamName,
      team_status:       teamStatus,
      project_id:        r.workspaces?.teams?.projects?.id ?? null,
      project_name:      r.workspaces?.teams?.projects?.name ?? null,
      metadata:          r.metadata,
      created_at:        r.created_at,
      account_name:      r.accounts?.name ?? null,
      account_email:     r.accounts?.email ?? null,
      forwarded_content: contentMap.get(r.id) ?? null,
    }
  })
}

// ── Audit View (Fase 2) — anclas nuevas: Loaded Context + datos crudos para
// Prior steps / Downstream uses. Ver handoff-2026-07-b.md 2026-08-19 (Fase 2 Paso 0).

interface HierarchyMaps {
  workspaceMap: Map<string, { name: string; team_id: string | null }>
  teamMap:      Map<string, { name: string; status: 'active' | 'archived' | null; project_id: string | null }>
  projectMap:   Map<string, string>
}

// context_sources.team_id/project_id son TEXT libres (migración 017, sin FK real) —
// se resuelven contra estas 3 tablas chicas en vez de un join SQL directo.
async function getHierarchyMaps(supabase: ReturnType<typeof createClient>): Promise<HierarchyMaps> {
  const [{ data: workspaces }, { data: teams }, { data: projects }] = await Promise.all([
    supabase.from('workspaces').select('id, name, team_id'),
    supabase.from('teams').select('id, name, status, project_id'),
    supabase.from('projects').select('id, name'),
  ])

  const workspaceMap = new Map(
    ((workspaces ?? []) as { id: string; name: string; team_id: string }[])
      .map(w => [w.id, { name: w.name, team_id: w.team_id }])
  )
  const teamMap = new Map(
    ((teams ?? []) as { id: string; name: string; status: string | null; project_id: string }[])
      .map(t => [t.id, { name: t.name, status: t.status as 'active' | 'archived' | null, project_id: t.project_id }])
  )
  const projectMap = new Map(
    ((projects ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name])
  )

  return { workspaceMap, teamMap, projectMap }
}

export interface DocLoadedContextItem {
  id:             string
  flavor:         'context_files' | 'chat'
  origin_type:    'checkpoint' | 'handoff_package' | 'saved_selection'
  origin_id:      string
  title:          string
  workspace_id:   string
  workspace_name: string
  team_id:        string | null
  team_name:      string | null
  team_status:    'active' | 'archived' | null
  project_id:     string | null
  project_name:   string | null
  created_at:     string
}

// Sabor "→ Context Files": fila real de context_sources con origin_type poblado
// (Load Saved Context → Context Files, FK real desde migración 017).
export async function getContextSourcesWithOrigin(): Promise<DocLoadedContextItem[]> {
  const supabase = createClient()
  const [{ data }, { teamMap, workspaceMap, projectMap }] = await Promise.all([
    supabase
      .from('context_sources')
      .select('id, title, origin_type, origin_message_id, workspace_id, team_id, project_id, created_at')
      .not('origin_type', 'is', null)
      .eq('status', 'active'),
    getHierarchyMaps(supabase),
  ])

  return ((data ?? []) as unknown as Array<{
    id: string
    title: string
    origin_type: string
    origin_message_id: string
    workspace_id: string | null
    team_id: string | null
    project_id: string | null
    created_at: string
  }>).map(r => {
    const team = r.team_id ? teamMap.get(r.team_id) : undefined
    const ws   = r.workspace_id ? workspaceMap.get(r.workspace_id) : undefined
    return {
      id:             r.id,
      flavor:         'context_files' as const,
      origin_type:    r.origin_type as DocLoadedContextItem['origin_type'],
      origin_id:      r.origin_message_id,
      title:          r.title,
      workspace_id:   r.workspace_id ?? '',
      workspace_name: ws?.name ?? '—',
      team_id:        r.team_id,
      team_name:      team?.name ?? null,
      team_status:    team?.status ?? null,
      project_id:     r.project_id,
      project_name:   r.project_id ? projectMap.get(r.project_id) ?? null : null,
      created_at:     r.created_at,
    }
  })
}

export interface DocWorkspaceSession {
  id:         string
  agent_role: string
}

// workspace_id -> agent_sessions del workspace — usado por Audit View (Fase 2,
// Paso 3) para saber qué sesiones consultar en /api/documentation/audit-detail
// (mensajes clave, Prompts/Context Files scope Session).
export async function getWorkspaceSessionsMap(): Promise<Record<string, DocWorkspaceSession[]>> {
  const supabase = createClient()
  const { data } = await supabase.from('agent_sessions').select('id, workspace_id, agent_role')

  const map: Record<string, DocWorkspaceSession[]> = {}
  for (const r of (data ?? []) as { id: string; workspace_id: string; agent_role: string }[]) {
    if (!map[r.workspace_id]) map[r.workspace_id] = []
    map[r.workspace_id].push({ id: r.id, agent_role: r.agent_role })
  }
  return map
}

export interface DocContextSourceScopeRow {
  id:         string
  project_id: string | null
  team_id:    string | null
  created_at: string
}

// Fila mínima de TODOS los context_sources activos (no solo los que tienen
// origin_type poblado) — usada únicamente para el stat "Context sources" del
// Top Stats Bar de Audit View, que cuenta el repositorio completo en alcance,
// no solo el subconjunto que además es ancla "Loaded Context".
export async function getContextSourcesScopeStats(): Promise<DocContextSourceScopeRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('context_sources')
    .select('id, project_id, team_id, created_at')
    .eq('status', 'active')

  return (data ?? []) as DocContextSourceScopeRow[]
}

export interface DocMessageProvenanceItem {
  id:                  string
  source_object_type:  'checkpoint' | 'handoff_package' | 'saved_selection' | 'review_forward'
  source_object_id:    string
  workspace_id:        string
  workspace_name:      string
  team_id:             string | null
  team_name:           string | null
  team_status:         'active' | 'archived' | null
  project_id:          string | null
  project_name:        string | null
  created_at:          string
}

// TODAS las filas de message_provenance (los 2 destinos "→ Chat": Load Saved
// Context, migración 054, y Review & Forward Agent↔Agente, migración 055).
// Se usa tanto para el sabor "chat" de la ancla Loaded Context como para
// Downstream uses de Checkpoint/Handoff/Saved Selection/Review & Forward.
export async function getAllMessageProvenance(): Promise<DocMessageProvenanceItem[]> {
  const supabase = createClient()
  const [{ data }, { teamMap, workspaceMap, projectMap }] = await Promise.all([
    supabase
      .from('message_provenance')
      .select('id, source_object_type, source_object_id, created_at, messages(session_id, agent_sessions(workspace_id))'),
    getHierarchyMaps(supabase),
  ])

  return ((data ?? []) as unknown as Array<{
    id: string
    source_object_type: string
    source_object_id: string
    created_at: string
    messages: { session_id: string; agent_sessions: { workspace_id: string } | null } | null
  }>).map(r => {
    const wsId = r.messages?.agent_sessions?.workspace_id ?? null
    const ws   = wsId ? workspaceMap.get(wsId) : undefined
    const team = ws?.team_id ? teamMap.get(ws.team_id) : undefined
    return {
      id:                 r.id,
      source_object_type: r.source_object_type as DocMessageProvenanceItem['source_object_type'],
      source_object_id:   r.source_object_id,
      workspace_id:       wsId ?? '',
      workspace_name:     ws?.name ?? '—',
      team_id:            ws?.team_id ?? null,
      team_name:          team?.name ?? null,
      team_status:        team?.status ?? null,
      project_id:         team?.project_id ?? null,
      project_name:       team?.project_id ? projectMap.get(team.project_id) ?? null : null,
      created_at:         r.created_at,
    }
  })
}
