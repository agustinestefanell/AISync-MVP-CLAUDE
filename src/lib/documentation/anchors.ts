// Unificación de los 5 tipos de ancla auditable/investigable (Checkpoint,
// Handoff Package, Saved Selection, Loaded Context, Review & Forward).
// Extraído de AuditView.tsx (Fase 2, 2026-08-19) al construir Investigate
// View (Fase A, 2026-08-20) — misma semántica de ancla, necesaria sin
// cambios en las 2 vistas. Ver handoff-2026-07-b.md 2026-08-20.

import type {
  DocCheckpoint,
  DocHandoffPackage,
  DocSavedSelection,
  DocAuditEvent,
  DocLoadedContextItem,
  DocMessageProvenanceItem,
} from '@/lib/db/documentation'

export type AnchorKind = 'checkpoint' | 'handoff' | 'saved_selection' | 'loaded_context' | 'review_forward'

export type AnchorItem =
  | { kind: 'checkpoint';      cp: DocCheckpoint }
  | { kind: 'handoff';         hp: DocHandoffPackage }
  | { kind: 'saved_selection'; ss: DocSavedSelection }
  | { kind: 'loaded_context';  lc: DocLoadedContextItem }
  | { kind: 'review_forward';  rf: DocAuditEvent }

export interface AnchorMeta {
  id:          string
  date:        string
  wsId:        string
  wsName:      string
  teamId:      string | null
  teamName:    string | null
  teamStatus:  'active' | 'archived' | null
  projectId:   string | null
  projectName: string | null
}

export const AGENT_LABEL: Record<string, string> = {
  manager:    'Manager',
  worker1:    'Worker 1',
  worker2:    'Worker 2',
  human_chat: 'Human Chat',
}

export const ORIGIN_LABEL: Record<string, string> = {
  checkpoint:      'Checkpoint',
  handoff_package: 'Handoff Package',
  saved_selection: 'Saved Selection',
}

// Nombre completo por tipo de ancla — usado por el header "Audit Target" de
// Audit View y por el índice de búsqueda del SM de Documentation Mode.
export const ANCHOR_KIND_LABEL: Record<AnchorKind, string> = {
  checkpoint:      'Checkpoint',
  handoff:         'Handoff Package',
  saved_selection: 'Saved Selection',
  loaded_context:  'Loaded Context',
  review_forward:  'Review & Forward',
}

export function anchorId(item: AnchorItem): string {
  switch (item.kind) {
    case 'checkpoint':      return item.cp.id
    case 'handoff':          return item.hp.id
    case 'saved_selection':  return item.ss.id
    case 'loaded_context':   return item.lc.id
    case 'review_forward':   return item.rf.id
  }
}

export function anchorMeta(item: AnchorItem): AnchorMeta {
  switch (item.kind) {
    case 'checkpoint':
      return { id: item.cp.id, date: item.cp.created_at, wsId: item.cp.workspace_id, wsName: item.cp.workspace_name, teamId: item.cp.team_id || null, teamName: item.cp.team_name, teamStatus: item.cp.team_status, projectId: item.cp.project_id || null, projectName: item.cp.project_name }
    case 'handoff':
      return { id: item.hp.id, date: item.hp.created_at, wsId: item.hp.workspace_id, wsName: item.hp.workspace_name, teamId: item.hp.team_id, teamName: item.hp.team_name, teamStatus: item.hp.team_status, projectId: item.hp.project_id, projectName: item.hp.project_name }
    case 'saved_selection':
      return { id: item.ss.id, date: item.ss.created_at, wsId: item.ss.workspace_id, wsName: item.ss.workspace_name, teamId: item.ss.team_id, teamName: item.ss.team_name, teamStatus: item.ss.team_status, projectId: item.ss.project_id, projectName: item.ss.project_name }
    case 'loaded_context':
      return { id: item.lc.id, date: item.lc.created_at, wsId: item.lc.workspace_id, wsName: item.lc.workspace_name, teamId: item.lc.team_id, teamName: item.lc.team_name, teamStatus: item.lc.team_status, projectId: item.lc.project_id, projectName: item.lc.project_name }
    case 'review_forward':
      return { id: item.rf.id, date: item.rf.created_at, wsId: item.rf.workspace_id ?? '', wsName: item.rf.workspace_name ?? '—', teamId: item.rf.team_id, teamName: item.rf.team_name, teamStatus: item.rf.team_status, projectId: item.rf.project_id, projectName: item.rf.project_name }
  }
}

export function anchorTitle(item: AnchorItem): string {
  switch (item.kind) {
    case 'checkpoint':      return item.cp.name
    case 'handoff':          return item.hp.name
    case 'saved_selection':  return item.ss.name
    case 'loaded_context':   return item.lc.flavor === 'context_files' ? item.lc.title : 'Loaded into Chat'
    case 'review_forward': {
      const from = AGENT_LABEL[(item.rf.metadata?.from as string) ?? ''] ?? (item.rf.metadata?.from as string) ?? '—'
      const to   = AGENT_LABEL[(item.rf.metadata?.to as string)   ?? ''] ?? (item.rf.metadata?.to as string)   ?? '—'
      return `Review & Forward: ${from} → ${to}`
    }
  }
}

// "origen→destino (si aplica)" — solo Handoff y Loaded Context tienen un
// movimiento origen/destino real que mostrar; los demás vuelven null.
export function anchorFlow(item: AnchorItem): string | null {
  switch (item.kind) {
    case 'handoff':
      return `${AGENT_LABEL[item.hp.from_agent] ?? item.hp.from_agent} → ${AGENT_LABEL[item.hp.to_agent] ?? item.hp.to_agent}`
    case 'loaded_context':
      return `${ORIGIN_LABEL[item.lc.origin_type] ?? item.lc.origin_type} → ${item.lc.flavor === 'context_files' ? 'Context Files' : 'Chat'}`
    default:
      return null
  }
}

// Ancla origen de la sesión (agent_role) cuando es conocida directamente sin
// fetch adicional — usada por Investigate View para pasarle a
// /api/investigation-scan el rol de origen ya resuelto client-side, evitando
// que el endpoint tenga que re-consultarlo para Handoff/Review & Forward.
export function anchorOriginAgentRole(item: AnchorItem): string | undefined {
  switch (item.kind) {
    case 'handoff':         return item.hp.from_agent
    case 'review_forward':  return (item.rf.metadata?.from as string) ?? undefined
    default:                return undefined
  }
}

// Anclas unificadas (5 tipos) a partir de las fuentes ya cargadas por
// DocClient.tsx — misma construcción que AuditView.tsx (Fase 2), reusada
// ahora también por Investigate View. mpChat filtra 'review_forward' para no
// duplicar con la ancla Review & Forward propia.
export function buildAnchors(
  checkpoints:              DocCheckpoint[],
  handoffPackages:          DocHandoffPackage[],
  savedSelections:          DocSavedSelection[],
  contextSourcesWithOrigin: DocLoadedContextItem[],
  messageProvenance:        DocMessageProvenanceItem[],
  auditEvents:              DocAuditEvent[],
): AnchorItem[] {
  const cps: AnchorItem[] = checkpoints.map(cp => ({ kind: 'checkpoint', cp }))
  const hps: AnchorItem[] = handoffPackages.map(hp => ({ kind: 'handoff', hp }))
  const sss: AnchorItem[] = savedSelections.map(ss => ({ kind: 'saved_selection', ss }))
  const lcs: AnchorItem[] = contextSourcesWithOrigin.map(lc => ({ kind: 'loaded_context', lc }))
  const mpChat: AnchorItem[] = messageProvenance
    .filter(mp => mp.source_object_type !== 'review_forward')
    .map(mp => ({
      kind: 'loaded_context',
      lc: {
        id:             mp.id,
        flavor:         'chat',
        origin_type:    mp.source_object_type as DocLoadedContextItem['origin_type'],
        origin_id:      mp.source_object_id,
        title:          'Loaded into Chat',
        workspace_id:   mp.workspace_id,
        workspace_name: mp.workspace_name,
        team_id:        mp.team_id,
        team_name:      mp.team_name,
        team_status:    mp.team_status,
        project_id:     mp.project_id,
        project_name:   mp.project_name,
        created_at:     mp.created_at,
      },
    }))
  const rfs: AnchorItem[] = auditEvents
    .filter(e => e.event_type === 'review_forward')
    .map(rf => ({ kind: 'review_forward', rf }))
  return [...cps, ...hps, ...sss, ...lcs, ...mpChat, ...rfs]
}

// ── Downstream uses — "¿este ancla fue usada después por otro objeto?" ──────
// Mapas construidos una sola vez sobre las fuentes ya cargadas, no por ancla.
// Usado tanto por el badge "Used downstream"/"Not used yet" de Audit View
// como por el mismo badge de Investigate View (2026-08-20).
export interface DownstreamMaps {
  general:             Map<string, number> // `${origin_type}:${origin_id}` — checkpoint/handoff_package/saved_selection
  reviewForward:       Map<string, number> // audit_log.id (review_forward event) -> count
  contextFileInjected: Map<string, number> // context_sources.id -> count
}

export function buildDownstreamMaps(
  contextSourcesWithOrigin: DocLoadedContextItem[],
  messageProvenance:        DocMessageProvenanceItem[],
  auditEvents:               DocAuditEvent[],
): DownstreamMaps {
  const general = new Map<string, number>()
  const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1)

  for (const cs of contextSourcesWithOrigin) bump(general, `${cs.origin_type}:${cs.origin_id}`)

  const reviewForward = new Map<string, number>()
  for (const mp of messageProvenance) {
    if (mp.source_object_type === 'review_forward') { bump(reviewForward, mp.source_object_id); continue }
    bump(general, `${mp.source_object_type}:${mp.source_object_id}`)
  }

  const contextFileInjected = new Map<string, number>()
  for (const e of auditEvents) {
    if (e.event_type !== 'context_file_injected') continue
    const ids = (e.metadata?.context_source_ids as string[] | undefined) ?? []
    for (const id of ids) bump(contextFileInjected, id)
  }

  return { general, reviewForward, contextFileInjected }
}

export function downstreamUsesFor(item: AnchorItem, maps: DownstreamMaps): number {
  switch (item.kind) {
    case 'checkpoint':      return maps.general.get(`checkpoint:${item.cp.id}`) ?? 0
    case 'handoff':          return maps.general.get(`handoff_package:${item.hp.id}`) ?? 0
    case 'saved_selection':  return maps.general.get(`saved_selection:${item.ss.id}`) ?? 0
    case 'loaded_context':   return item.lc.flavor === 'context_files' ? (maps.contextFileInjected.get(item.lc.id) ?? 0) : 0
    case 'review_forward':   return maps.reviewForward.get(item.rf.id) ?? 0
  }
}

// ── Índice de búsqueda para el SM de Documentation Mode (2026-08-20) ────────
// El SM ya no ve solo Checkpoints — ve las 5 anclas, con una `key` estable
// (`${kind}:${id}`) que el modelo debe citar literalmente en su respuesta
// JSON (`{"matches": ["checkpoint:uuid", ...]}`), nunca inventar. `key`
// coincide exactamente con el `${kind}:${id}` que Audit View/Investigate
// View ya usan como `selectedKey` interno — permite pasarlo directo como
// `externalSelectedKey` sin ninguna conversión.
export interface AnchorSearchItem {
  key:       string
  kind:      AnchorKind
  id:        string
  title:     string
  project:   string
  team:      string
  workspace: string
  date:      string
}

export function buildAnchorSearchIndex(anchors: AnchorItem[]): AnchorSearchItem[] {
  return anchors
    .map(item => {
      const meta = anchorMeta(item)
      const id   = anchorId(item)
      return {
        key:       `${item.kind}:${id}`,
        kind:      item.kind,
        id,
        title:     anchorTitle(item),
        project:   meta.projectName ?? '—',
        team:      meta.teamName ?? '—',
        workspace: meta.wsName,
        date:      meta.date,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
