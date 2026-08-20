'use client'

import { useState, useMemo, useEffect } from 'react'
import type { DocCheckpoint, DocHandoffPackage, DocSavedSelection, DocAuditEvent, DocLoadedContextItem, DocMessageProvenanceItem } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import {
  type AnchorKind,
  anchorId,
  anchorMeta,
  anchorTitle,
  anchorFlow,
  anchorOriginAgentRole,
  buildAnchors,
  buildDownstreamMaps,
  downstreamUsesFor,
} from '@/lib/documentation/anchors'
import InvestigationScanPanel from './InvestigationScanPanel'

// ── Investigate View rediseñada (Fase A, 2026-08-20) — Investigation Brief
// (focus + filtros + Top Stats) + lista de las 5 anclas (mismo patrón que
// Audit View) + panel derecho de Session Scan/Deep Search.
// Explícitamente fuera de esta fase: Evidence Funnel con scoring, Evidence
// Board con categorización automática, "Investigation Cases" persistentes,
// y cualquier extensión del panel SM lateral. Ver handoff-2026-07-b.md
// 2026-08-20 y la consigna original de la OE.

const TYPE_BADGE: Record<AnchorKind, { label: string; className: string }> = {
  checkpoint:      { label: 'CHECKPOINT',      className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  handoff:         { label: 'HANDOFF PACKAGE', className: 'text-purple-700 bg-purple-50 border-purple-200' },
  saved_selection: { label: 'SAVED SELECTION', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  loaded_context:  { label: 'LOADED CONTEXT',  className: 'text-blue-700 bg-blue-50 border-blue-200' },
  review_forward:  { label: 'REVIEW & FORWARD', className: 'text-pink-700 bg-pink-50 border-pink-200' },
}

const ANCHOR_KIND_LABEL: Record<AnchorKind, string> = {
  checkpoint:      'Checkpoint',
  handoff:         'Handoff Package',
  saved_selection: 'Saved Selection',
  loaded_context:  'Loaded Context',
  review_forward:  'Review & Forward',
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

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-5 py-4 min-w-[160px]">
      <p className="ui-title text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="ui-label text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium tracking-wide uppercase">{label}</p>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
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
  projects:                 ProjectWithTeams[]
  userEmail:                string
  teamCodes?:               Record<string, string>
}

export default function InvestigateView({
  checkpoints, handoffPackages, savedSelections, auditEvents,
  contextSourcesWithOrigin, messageProvenance, projects, teamCodes,
}: Props) {
  const [investigationFocus, setInvestigationFocus] = useState('')
  const [filterProject,      setFilterProject]      = useState('')
  const [filterTeam,         setFilterTeam]         = useState('')
  const [filterAnchorType,   setFilterAnchorType]   = useState<AnchorKind | ''>('')
  const [filterDateStart,    setFilterDateStart]    = useState('')
  const [filterDateEnd,      setFilterDateEnd]      = useState('')
  const [selectedKey,        setSelectedKey]        = useState<string | null>(null)

  const allAnchors = useMemo(
    () => buildAnchors(checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents),
    [checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents],
  )

  const downstreamMaps = useMemo(
    () => buildDownstreamMaps(contextSourcesWithOrigin, messageProvenance, auditEvents),
    [contextSourcesWithOrigin, messageProvenance, auditEvents],
  )

  const uniqueProjects = useMemo(() => projects.map(p => [p.id, p.name] as [string, string]), [projects])

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

  useEffect(() => {
    if (filterTeam && !uniqueTeams.some(([id]) => id === filterTeam)) {
      setFilterTeam('')
    }
  }, [filterTeam, uniqueTeams])

  const filtered = useMemo(() => allAnchors.filter(item => {
    const meta = anchorMeta(item)
    if (filterProject    && meta.projectId !== filterProject)    return false
    if (filterTeam       && meta.teamId    !== filterTeam)       return false
    if (filterAnchorType && item.kind      !== filterAnchorType) return false
    const day = meta.date.slice(0, 10)
    if (filterDateStart && day < filterDateStart) return false
    if (filterDateEnd   && day > filterDateEnd)   return false
    return true
  }), [allAnchors, filterProject, filterTeam, filterAnchorType, filterDateStart, filterDateEnd])

  const sortedItems = useMemo(
    () => [...filtered].sort((a, b) => anchorMeta(b).date.localeCompare(anchorMeta(a).date)),
    [filtered],
  )

  // Top Stats — mismo patrón reactivo a Project/Team/Date que Audit View
  // (ver handoff-2026-07-b.md 2026-08-20 Paso 0 punto 5).
  const eventsInSelectedRange = useMemo(() => auditEvents.filter(e => {
    if (filterProject && e.project_id !== filterProject) return false
    if (filterTeam    && e.team_id    !== filterTeam)    return false
    const day = e.created_at.slice(0, 10)
    if (filterDateStart && day < filterDateStart) return false
    if (filterDateEnd   && day > filterDateEnd)   return false
    return true
  }).length, [auditEvents, filterProject, filterTeam, filterDateStart, filterDateEnd])

  const selectedItem = useMemo(() =>
    selectedKey ? allAnchors.find(a => `${a.kind}:${anchorId(a)}` === selectedKey) ?? null : null
  , [selectedKey, allAnchors])

  function resetFilters() {
    setInvestigationFocus('')
    setFilterProject(''); setFilterTeam(''); setFilterAnchorType('')
    setFilterDateStart(''); setFilterDateEnd('')
  }
  const hasFilter = investigationFocus || filterProject || filterTeam || filterAnchorType || filterDateStart || filterDateEnd

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Investigation Brief */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-default)] flex flex-wrap gap-4 items-start">
        <div className="flex-1 min-w-[320px] space-y-3">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Investigation Focus</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={investigationFocus}
              onChange={e => setInvestigationFocus(e.target.value)}
              placeholder="What are you trying to confirm or find out? e.g. Confirm scope reductions were justified before the termination clause revision."
              className="flex-1 bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
            {investigationFocus && (
              <button onClick={() => setInvestigationFocus('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 text-sm">✕</button>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            This focus is used as the question for Session Scan / Deep Search when you inspect an anchor below.
          </p>
          <div className="flex flex-wrap gap-2">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
              <option value="">All projects</option>
              {uniqueProjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
              <option value="">All teams</option>
              {uniqueTeams.map(([id, name]) => <option key={id} value={id}>{teamLabel(id, name, teamCodes)}</option>)}
            </select>
            <select value={filterAnchorType} onChange={e => setFilterAnchorType(e.target.value as AnchorKind | '')}
              className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
              <option value="">All anchor types (5)</option>
              <option value="checkpoint">Checkpoint</option>
              <option value="handoff">Handoff Package</option>
              <option value="saved_selection">Saved Selection</option>
              <option value="loaded_context">Loaded Context</option>
              <option value="review_forward">Review &amp; Forward</option>
            </select>
            <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
              className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]" />
            <span className="text-xs text-[var(--color-text-muted)] self-center">to</span>
            <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
              className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]" />
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2">
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          <StatCard label="Anchors in scope" value={filtered.length} />
          <StatCard label="Events in selected range" value={eventsInSelectedRange} />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Panel izquierdo: lista de anclas */}
        <div className={`flex flex-col min-h-0 ${selectedItem ? 'w-1/2' : 'flex-1'} min-w-0 ${selectedItem ? 'border-r border-[var(--color-border-subtle)]' : ''}`}>
          <div className="flex-1 overflow-y-auto">
            {sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="text-4xl">🔍</span>
                <p className="text-[var(--color-text-primary)] font-medium">
                  {allAnchors.length === 0 ? 'No anchors yet' : 'No results found'}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
                  {allAnchors.length === 0
                    ? 'Save a checkpoint, handoff, selection, or forward a message from the Workspace to see it here.'
                    : 'Try different filters.'}
                </p>
                {hasFilter && (
                  <button onClick={resetFilters} className="mt-2 text-sm text-[var(--color-accent)] underline hover:opacity-75">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 grid gap-3 content-start">
                {sortedItems.map(item => {
                  const meta       = anchorMeta(item)
                  const badge      = TYPE_BADGE[item.kind]
                  const flow       = anchorFlow(item)
                  const downstream = downstreamUsesFor(item, downstreamMaps)
                  const chain      = CHAIN_BADGE[downstream > 0 ? 'used' : 'not_used']
                  const id         = anchorId(item)
                  const key        = `${item.kind}:${id}`

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
                          {flow && <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{flow}</p>}
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                            {meta.projectName ?? '—'} · {teamLabel(meta.teamId, meta.teamName, teamCodes)} · {meta.wsName} · <span suppressHydrationWarning>{formatDate(meta.date)}</span>
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

        {/* Panel derecho: Session Scan / Deep Search */}
        {selectedItem && (() => {
          const meta = anchorMeta(selectedItem)
          const lc = selectedItem.kind === 'loaded_context' ? selectedItem.lc : null
          return (
            <InvestigationScanPanel
              anchorKindLabel={ANCHOR_KIND_LABEL[selectedItem.kind]}
              title={anchorTitle(selectedItem)}
              meta={meta}
              workspaceId={meta.wsId}
              anchorKind={selectedItem.kind}
              anchorId={anchorId(selectedItem)}
              originAgentRole={anchorOriginAgentRole(selectedItem)}
              flavor={lc?.flavor}
              originType={lc?.flavor === 'context_files' ? lc.origin_type : undefined}
              originId={lc?.flavor === 'context_files' ? lc.origin_id : undefined}
              investigationFocus={investigationFocus}
              teamCodes={teamCodes}
              onClose={() => setSelectedKey(null)}
            />
          )
        })()}
      </div>
    </div>
  )
}
