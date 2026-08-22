'use client'

import { useState, useMemo, useEffect } from 'react'
import type {
  DocCheckpoint,
  DocHandoffPackage,
  DocSavedSelection,
  DocAuditEvent,
  DocLoadedContextItem,
  DocMessageProvenanceItem,
  DocContextSourceScopeRow,
  DocWorkspaceSession,
} from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import AuditDetailPanel from './AuditDetailPanel'
import {
  type AnchorKind,
  type AnchorItem,
  type AnchorMeta,
  AGENT_LABEL,
  ORIGIN_LABEL,
  ANCHOR_KIND_LABEL,
  anchorId,
  anchorMeta,
  anchorTitle,
  anchorFlow,
  anchorExecutedBy,
  reviewForwardParties,
  buildAnchors,
  buildDownstreamMaps,
  downstreamUsesFor,
  PRIOR_STEP_TYPES,
} from '@/lib/documentation/anchors'

export type { AnchorMeta } from '@/lib/documentation/anchors'

// ── Audit View rediseñada (Fase 2) — Paso 1 (Top Stats Bar) + Paso 2 (lista de
// anclas) + Paso 3 (panel derecho de reconstrucción).
// Fórmulas y decisiones de diseño: ver handoff-2026-07-b.md 2026-08-19 (Fase 2
// Paso 0) y la ronda de Fase 1.6 (Downstream uses de Review & Forward).
// AnchorKind/AnchorItem/AnchorMeta/anchorId/anchorMeta/anchorTitle/anchorFlow
// extraídos a src/lib/documentation/anchors.ts (2026-08-20) — reusados
// también por Investigate View, sin cambio de comportamiento acá.

const TYPE_BADGE: Record<AnchorKind, { label: string; className: string }> = {
  checkpoint:      { label: 'CHECKPOINT',      className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  handoff:         { label: 'HANDOFF',         className: 'text-purple-700 bg-purple-50 border-purple-200' },
  saved_selection: { label: 'SAVE SELECTION',  className: 'text-amber-700 bg-amber-50 border-amber-200' },
  loaded_context:  { label: 'LOADED CONTEXT',  className: 'text-blue-700 bg-blue-50 border-blue-200' },
  review_forward:  { label: 'R&F',             className: 'text-pink-700 bg-pink-50 border-pink-200' },
}

const CHAIN_BADGE: Record<'used' | 'not_used', { label: string; className: string }> = {
  used:     { label: 'Used downstream', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  not_used: { label: 'Not used yet',    className: 'text-gray-600 bg-gray-50 border-gray-200' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function teamLabel(id: string | null, name: string | null, codes?: Record<string, string>): string {
  if (!name) return '—'
  const code = id ? codes?.[id] : undefined
  return code ? `${code} · ${name}` : name
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-5 py-4">
      <p className="ui-title text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="ui-label text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

interface Props {
  checkpoints:              DocCheckpoint[]
  handoffPackages:          DocHandoffPackage[]
  savedSelections:          DocSavedSelection[]
  auditEvents:              DocAuditEvent[]
  contextSourcesWithOrigin: DocLoadedContextItem[]
  messageProvenance:        DocMessageProvenanceItem[]
  contextSourcesScopeStats: DocContextSourceScopeRow[]
  workspaceSessions:        Record<string, DocWorkspaceSession[]>
  projects:                 ProjectWithTeams[]
  teamCodes?:               Record<string, string>
  externalSelectedKey?:     string | null
  // Deep-link desde el botón "Go to Audit →" de Structure View (2026-08-20)
  // — siembra el filtro Team al montar, mismo criterio que `externalSelectedKey`.
  initialFilterTeam?:       string
}

export default function AuditView({
  checkpoints, handoffPackages, savedSelections, auditEvents,
  contextSourcesWithOrigin, messageProvenance, contextSourcesScopeStats, workspaceSessions, projects, teamCodes,
  externalSelectedKey, initialFilterTeam,
}: Props) {
  const [filterProject,    setFilterProject]    = useState('')
  const [filterTeam,       setFilterTeam]       = useState(initialFilterTeam ?? '')
  const [filterAnchorType, setFilterAnchorType] = useState<AnchorKind | ''>('')
  const [filterChainState, setFilterChainState] = useState<'used' | 'not_used' | ''>('')
  const [filterDate,       setFilterDate]       = useState('')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [sortOrder,        setSortOrder]        = useState<'newest' | 'oldest' | 'name'>('newest')
  const [selectedKey,      setSelectedKey]      = useState<string | null>(null)

  // Ancla abierta desde afuera (link del SM de Documentation Mode, 2026-08-20)
  // — mismo patrón que `externalSelectedId` de RepositoryView.tsx. `key` ya
  // viene en formato `${kind}:${id}`, idéntico al `selectedKey` interno.
  useEffect(() => {
    if (externalSelectedKey) setSelectedKey(externalSelectedKey)
  }, [externalSelectedKey])

  // ── Anclas unificadas (5 tipos) ─────────────────────────────────────────
  const allAnchors = useMemo(
    () => buildAnchors(checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents),
    [checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents],
  )

  // ── Downstream uses — mapas construidos una vez, no por ancla ──────────
  const downstreamMaps = useMemo(
    () => buildDownstreamMaps(contextSourcesWithOrigin, messageProvenance, auditEvents),
    [contextSourcesWithOrigin, messageProvenance, auditEvents],
  )

  function downstreamUsesForItem(item: AnchorItem): number {
    return downstreamUsesFor(item, downstreamMaps)
  }

  // ── Prior steps — eventos reales del mismo workspace entre audit_start
  // (último save_version/resume_work anterior, fallback: primer evento
  // conocido del workspace) y audit_end (la propia ancla) ─────────────────
  const eventsByWorkspace = useMemo(() => {
    const m = new Map<string, DocAuditEvent[]>()
    for (const e of auditEvents) {
      if (!e.workspace_id) continue
      if (!m.has(e.workspace_id)) m.set(e.workspace_id, [])
      m.get(e.workspace_id)!.push(e)
    }
    Array.from(m.values()).forEach(arr => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)))
    return m
  }, [auditEvents])

  // audit_start + eventos reales entre audit_start (exclusivo) y audit_end
  // (inclusivo) — usado tanto para el número "Prior steps" de la card como
  // para el timeline real del panel derecho (Paso 3), misma fuente para que
  // el número y la lista nunca queden inconsistentes entre sí.
  function computeTimeline(item: AnchorItem, meta: AnchorMeta): { auditStart: string; events: DocAuditEvent[] } {
    const events = eventsByWorkspace.get(meta.wsId) ?? []
    if (events.length === 0) return { auditStart: meta.date, events: [] }
    let auditStart: string | null = null
    for (const e of events) {
      if (e.created_at >= meta.date) break
      if (e.event_type === 'save_version' || e.event_type === 'resume_work') auditStart = e.created_at
    }
    const start = auditStart ?? events[0].created_at
    const selfId = item.kind === 'review_forward' ? item.rf.id : null
    const window = events.filter(e =>
      e.id !== selfId &&
      e.created_at > start &&
      e.created_at <= meta.date &&
      PRIOR_STEP_TYPES.has(e.event_type)
    )
    return { auditStart: start, events: window }
  }

  function priorStepsFor(item: AnchorItem, meta: AnchorMeta): number {
    return computeTimeline(item, meta).events.length
  }

  // ── Chain of Custody — origen (si esta ancla vino de otro objeto) y
  // downstream (objetos reales que usaron esta ancla como fuente, no solo el
  // conteo) — todo resuelto contra los arrays ya cargados, sin fetch nuevo.
  const checkpointById     = useMemo(() => new Map(checkpoints.map(cp => [cp.id, cp.name])), [checkpoints])
  const handoffById        = useMemo(() => new Map(handoffPackages.map(hp => [hp.id, hp.name])), [handoffPackages])
  const savedSelectionById = useMemo(() => new Map(savedSelections.map(ss => [ss.id, ss.name])), [savedSelections])

  function computeOrigin(item: AnchorItem): { label: string; date?: string } | null {
    if (item.kind === 'loaded_context') {
      const originName =
        item.lc.origin_type === 'checkpoint'      ? checkpointById.get(item.lc.origin_id) :
        item.lc.origin_type === 'handoff_package' ? handoffById.get(item.lc.origin_id) :
        item.lc.origin_type === 'saved_selection' ? savedSelectionById.get(item.lc.origin_id) : undefined
      return { label: `${ORIGIN_LABEL[item.lc.origin_type] ?? item.lc.origin_type}: ${originName ?? '—'}` }
    }
    if (item.kind === 'review_forward') {
      const from = (item.rf.metadata?.from as string) ?? ''
      return { label: AGENT_LABEL[from] ?? from ?? '—' }
    }
    return null
  }

  function computeDownstreamItems(item: AnchorItem): { label: string; date: string }[] {
    const id = anchorId(item)
    const items: { label: string; date: string }[] = []
    if (item.kind === 'checkpoint' || item.kind === 'handoff' || item.kind === 'saved_selection') {
      const type = item.kind === 'checkpoint' ? 'checkpoint' : item.kind === 'handoff' ? 'handoff_package' : 'saved_selection'
      for (const cs of contextSourcesWithOrigin) {
        if (cs.origin_type === type && cs.origin_id === id) items.push({ label: `→ Context Files: ${cs.title}`, date: cs.created_at })
      }
      for (const mp of messageProvenance) {
        if (mp.source_object_type === type && mp.source_object_id === id) items.push({ label: '→ Chat', date: mp.created_at })
      }
    }
    if (item.kind === 'review_forward') {
      for (const mp of messageProvenance) {
        if (mp.source_object_type === 'review_forward' && mp.source_object_id === id) items.push({ label: '→ Delivered to Chat', date: mp.created_at })
      }
    }
    if (item.kind === 'loaded_context' && item.lc.flavor === 'context_files') {
      for (const e of auditEvents) {
        if (e.event_type !== 'context_file_injected') continue
        const ids = (e.metadata?.context_source_ids as string[] | undefined) ?? []
        if (ids.includes(id)) items.push({ label: '→ Injected into chat', date: e.created_at })
      }
    }
    return items.sort((a, b) => a.date.localeCompare(b.date))
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  // Fuente única: Projects activos reales de la cuenta (mismo prop que ya
  // usa Structure View), no solo los que tienen alguna ancla auditable
  // todavía — antes un Project sin ningún objeto documental no aparecía acá.
  const uniqueProjects = useMemo(() => projects.map(p => [p.id, p.name] as [string, string]), [projects])

  // Team depende de Project — mismo patrón ya aplicado también en
  // RepositoryView.tsx/InvestigateView.tsx (2026-08-20): si hay un Project
  // elegido, la lista de Teams se acota a los que pertenecen a ese Project.
  const uniqueTeams = useMemo(() => {
    const m = new Map<string, string>()
    for (const item of allAnchors) {
      const { projectId, teamId, teamName } = anchorMeta(item)
      if (filterProject && projectId !== filterProject) continue
      if (teamId && teamName) m.set(teamId, teamName)
    }
    return Array.from(m.entries()).sort(([idA, nameA], [idB, nameB]) => {
      const codeA = teamCodes?.[idA] ?? nameA
      const codeB = teamCodes?.[idB] ?? nameB
      return codeA.localeCompare(codeB)
    })
  }, [allAnchors, filterProject, teamCodes])

  // Si el Team elegido deja de pertenecer al Project recién elegido (o el
  // Project cambia a uno que no lo incluye), se resetea — evita quedar con
  // una combinación imposible seleccionada (0 resultados sin explicación).
  useEffect(() => {
    if (filterTeam && !uniqueTeams.some(([id]) => id === filterTeam)) {
      setFilterTeam('')
    }
  }, [filterTeam, uniqueTeams])

  const filtered = useMemo(() => allAnchors.filter(item => {
    const meta = anchorMeta(item)
    if (filterProject    && meta.projectId !== filterProject)    return false
    if (filterTeam        && meta.teamId    !== filterTeam)       return false
    if (filterAnchorType  && item.kind      !== filterAnchorType) return false
    if (filterDate        && !meta.date.startsWith(filterDate))   return false
    if (filterChainState) {
      const used = downstreamUsesForItem(item) > 0
      if (filterChainState === 'used' && !used)     return false
      if (filterChainState === 'not_used' && used)  return false
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allAnchors, filterProject, filterTeam, filterAnchorType, filterDate, filterChainState, downstreamMaps])

  const displayItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const searched = q
      ? filtered.filter(item => {
          const meta = anchorMeta(item)
          const title = anchorTitle(item)
          return (
            title.toLowerCase().includes(q) ||
            (meta.wsName ?? '').toLowerCase().includes(q) ||
            (meta.teamName ?? '').toLowerCase().includes(q)
          )
        })
      : filtered

    return [...searched].sort((a, b) => {
      if (sortOrder === 'name') return anchorTitle(a).localeCompare(anchorTitle(b))
      const dateA = anchorMeta(a).date
      const dateB = anchorMeta(b).date
      return sortOrder === 'oldest' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    })
  }, [filtered, searchQuery, sortOrder])

  // ── Top Stats Bar — las 4 reaccionan a Project/Team/fecha (confirmado con
  // el PO); Handoff chains/Context sources ignoran el filtro de tipo de
  // ancla y estado de cadena porque son intrínsecamente de un solo tipo ───
  const eventsInScope = useMemo(() => auditEvents.filter(e => {
    if (filterProject && e.project_id !== filterProject) return false
    if (filterTeam    && e.team_id    !== filterTeam)    return false
    if (filterDate    && !e.created_at.startsWith(filterDate)) return false
    return true
  }).length, [auditEvents, filterProject, filterTeam, filterDate])

  const handoffChains = useMemo(() => handoffPackages.filter(hp => {
    if (filterProject && hp.project_id !== filterProject) return false
    if (filterTeam    && hp.team_id    !== filterTeam)    return false
    if (filterDate    && !hp.created_at.startsWith(filterDate)) return false
    return true
  }).length, [handoffPackages, filterProject, filterTeam, filterDate])

  const contextSourcesInScope = useMemo(() => contextSourcesScopeStats.filter(cs => {
    if (filterProject && cs.project_id !== filterProject) return false
    if (filterTeam    && cs.team_id    !== filterTeam)    return false
    if (filterDate    && !cs.created_at.startsWith(filterDate)) return false
    return true
  }).length, [contextSourcesScopeStats, filterProject, filterTeam, filterDate])

  const selectedItem = useMemo(() =>
    selectedKey ? allAnchors.find(a => `${a.kind}:${anchorId(a)}` === selectedKey) ?? null : null
  , [selectedKey, allAnchors])

  function resetFilters() {
    setFilterProject(''); setFilterTeam(''); setFilterAnchorType(''); setFilterChainState('')
    setFilterDate(''); setSearchQuery(''); setSortOrder('newest')
  }
  const hasFilter = filterProject || filterTeam || filterAnchorType || filterChainState || filterDate || searchQuery

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Top Stats Bar */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Auditable Anchors" value={filtered.length} />
        <StatCard label="Events in scope"   value={eventsInScope} />
        <StatCard label="Handoff chains"    value={handoffChains} />
        <StatCard label="Context sources"   value={contextSourcesInScope} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Panel izquierdo: filtros + lista */}
        <div className={`flex flex-col min-h-0 ${selectedItem ? 'w-1/2' : 'flex-1'} min-w-0 ${selectedItem ? 'border-r border-[var(--color-border-subtle)]' : ''}`}>
          {/* Filtros */}
          <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All projects</option>
              {uniqueProjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All teams</option>
              {uniqueTeams.map(([id, name]) => <option key={id} value={id}>{teamLabel(id, name, teamCodes)}</option>)}
            </select>
            <select value={filterAnchorType} onChange={e => setFilterAnchorType(e.target.value as AnchorKind | '')}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All anchor types</option>
              <option value="handoff">Handoff Package</option>
              <option value="review_forward">Review &amp; Forward</option>
              <option value="saved_selection">Save Selection</option>
              <option value="checkpoint">Checkpoint</option>
              <option value="loaded_context">Loaded Context</option>
            </select>
            <select value={filterChainState} onChange={e => setFilterChainState(e.target.value as 'used' | 'not_used' | '')}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All chain states</option>
              <option value="used">Used downstream</option>
              <option value="not_used">Not used yet</option>
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
            <input
              type="text"
              placeholder="Search by title, object, agent, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[240px]"
            />
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-600 px-2">
                Reset
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="text-4xl">🔍</span>
                <p className="text-[var(--color-text-primary)] font-medium">
                  {allAnchors.length === 0 ? 'No auditable anchors yet' : 'No results found'}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
                  {allAnchors.length === 0
                    ? 'Save a checkpoint, handoff, selection, or forward a message from the Workspace to see it here.'
                    : 'Try different filters or search terms.'}
                </p>
                {hasFilter && (
                  <button onClick={resetFilters} className="mt-2 text-sm text-[var(--color-accent)] underline hover:opacity-75">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 grid gap-3 content-start">
                {displayItems.map(item => {
                  const meta      = anchorMeta(item)
                  const badge     = TYPE_BADGE[item.kind]
                  const flow      = anchorFlow(item)
                  const downstream = downstreamUsesForItem(item)
                  const prior      = priorStepsFor(item, meta)
                  const chain      = CHAIN_BADGE[downstream > 0 ? 'used' : 'not_used']
                  const executedBy = anchorExecutedBy(item)
                  const id         = anchorId(item)

                  const key = `${item.kind}:${id}`
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedKey(key)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(key) } }}
                      className={`rounded-[14px] border bg-[var(--color-surface)] px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--color-surface-subtle)] hover:border-indigo-300 ${
                        selectedKey === key ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-[var(--color-border-subtle)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                              {anchorTitle(item)}
                            </span>
                          </div>
                          {flow && (
                            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{flow}</p>
                          )}
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                            {teamLabel(meta.teamId, meta.teamName, teamCodes)} · {meta.wsName} · <span suppressHydrationWarning>{formatDate(meta.date)}</span>
                          </p>
                          {executedBy && (
                            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Executed by: {executedBy}</p>
                          )}
                          <p className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">
                            Prior steps: <span className="font-medium text-[var(--color-text-primary)]">{prior}</span>
                            {'   '}
                            Downstream uses: <span className="font-medium text-[var(--color-text-primary)]">{downstream}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${chain.className}`}>
                            {chain.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho: reconstrucción de auditoría (Paso 3) */}
        {selectedItem && (() => {
          const meta      = anchorMeta(selectedItem)
          const timeline  = computeTimeline(selectedItem, meta)
          const downstream = downstreamUsesForItem(selectedItem)
          return (
            <AuditDetailPanel
              anchorKindLabel={ANCHOR_KIND_LABEL[selectedItem.kind]}
              title={anchorTitle(selectedItem)}
              flow={anchorFlow(selectedItem)}
              meta={meta}
              priorSteps={timeline.events.length}
              chainState={downstream > 0 ? 'used' : 'not_used'}
              auditStart={timeline.auditStart}
              timelineEvents={timeline.events}
              origin={computeOrigin(selectedItem)}
              downstreamItems={computeDownstreamItems(selectedItem)}
              sessionIds={(workspaceSessions[meta.wsId] ?? []).map(s => s.id)}
              teamCodes={teamCodes}
              reviewForward={selectedItem.kind === 'review_forward' ? {
                ...reviewForwardParties(selectedItem.rf),
                isHumanTarget: (selectedItem.rf.metadata?.target_type === 'human_chat') || (selectedItem.rf.metadata?.to === 'human_chat'),
                content: selectedItem.rf.forwarded_content,
              } : undefined}
              onClose={() => setSelectedKey(null)}
            />
          )
        })()}
      </div>
    </div>
  )
}
