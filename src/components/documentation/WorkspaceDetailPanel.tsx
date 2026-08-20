'use client'

import { useMemo, useState } from 'react'
import {
  type AnchorItem,
  type AnchorKind,
  ANCHOR_KIND_LABEL,
  anchorId,
  anchorMeta,
  anchorTitle,
  anchorFlow,
} from '@/lib/documentation/anchors'

// ── Structure View — panel de detalle por Workspace (2026-08-20) ───────────
// Al hacer click en un nodo Team (nivel Workspace) del árbol, muestra los 5
// tipos de ancla de ese Workspace mezclados en orden cronológico. Nivel
// "Agent individual" (Manager/Worker por separado) queda fuera de esta OE —
// decisión de alcance: la atribución a un agente puntual es dispareja entre
// los 5 tipos (Checkpoint/Saved Selection pueden abarcar más de una sesión),
// mismo hallazgo ya confirmado para Session Scan. Ver DECISIONS.md 2026-08-20.
//
// Sin panel secundario por ítem (a diferencia de Audit View/Investigation
// Scan) — decisión deliberada, no un recorte accidental: acá el foco es
// "qué hay en este Workspace", no reconstruir la auditoría de un ítem
// puntual (eso ya lo resuelve Audit View). Un solo botón "Open Workspace →"
// en el header alcanza, ya que los 5 tipos comparten el mismo workspace_id
// por definición del filtro.

const TYPE_BADGE: Record<AnchorKind, { label: string; className: string }> = {
  checkpoint:      { label: 'CHECKPOINT',       className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  handoff:         { label: 'HANDOFF PACKAGE',  className: 'text-purple-700 bg-purple-50 border-purple-200' },
  saved_selection: { label: 'SAVED SELECTION',  className: 'text-amber-700 bg-amber-50 border-amber-200' },
  loaded_context:  { label: 'LOADED CONTEXT',   className: 'text-blue-700 bg-blue-50 border-blue-200' },
  review_forward:  { label: 'REVIEW & FORWARD', className: 'text-pink-700 bg-pink-50 border-pink-200' },
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

interface Props {
  workspaceId:   string
  workspaceName: string
  teamId:        string | null
  teamName:      string | null
  projectName:   string | null
  anchors:       AnchorItem[]
  teamCodes?:    Record<string, string>
  onClose:       () => void
}

export default function WorkspaceDetailPanel({
  workspaceId, workspaceName, teamId, teamName, projectName, anchors, teamCodes, onClose,
}: Props) {
  const [filterType,   setFilterType]   = useState<AnchorKind | ''>('')
  const [filterDate,   setFilterDate]   = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return anchors.filter(item => {
      if (filterType && item.kind !== filterType) return false
      const meta = anchorMeta(item)
      if (filterDate && !meta.date.startsWith(filterDate)) return false
      if (q && !anchorTitle(item).toLowerCase().includes(q)) return false
      return true
    })
  }, [anchors, filterType, filterDate, searchQuery])

  const displayItems = useMemo(
    () => [...filtered].sort((a, b) => anchorMeta(b).date.localeCompare(anchorMeta(a).date)),
    [filtered],
  )

  const hasFilter = filterType || filterDate || searchQuery
  function resetFilters() {
    setFilterType(''); setFilterDate(''); setSearchQuery('')
  }

  return (
    <div className="h-full min-h-0 flex flex-col flex-1 min-w-0 bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            Workspace
          </span>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight truncate">{workspaceName}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {projectName ?? '—'} · {teamLabel(teamId, teamName, teamCodes)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => window.open(`/workspace/${workspaceId}`, '_blank', 'noopener,noreferrer')}
            className="ui-button ui-button-primary min-h-7 px-3 text-[11px] text-white"
          >
            Open Workspace →
          </button>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm">✕</button>
        </div>
      </div>

      {/* Filtros — Type/Date/Search, sin Project/Team (ya resueltos por el árbol) */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
        <select value={filterType} onChange={e => setFilterType(e.target.value as AnchorKind | '')}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All anchor types (5)</option>
          <option value="checkpoint">Checkpoint</option>
          <option value="handoff">Handoff Package</option>
          <option value="saved_selection">Saved Selection</option>
          <option value="loaded_context">Loaded Context</option>
          <option value="review_forward">Review &amp; Forward</option>
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
        <input
          type="text"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[180px]"
        />
        {hasFilter && (
          <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-600 px-2">
            Reset
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-[var(--color-text-primary)] font-medium">
              {anchors.length === 0 ? 'No documents in this workspace yet' : 'No results found'}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
              {anchors.length === 0
                ? 'Save a checkpoint, handoff, selection, or forward a message from this Workspace to see it here.'
                : 'Try different filters.'}
            </p>
            {hasFilter && (
              <button onClick={resetFilters} className="mt-1 text-sm text-[var(--color-accent)] underline hover:opacity-75">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map(item => {
              const meta  = anchorMeta(item)
              const badge = TYPE_BADGE[item.kind]
              const flow  = anchorFlow(item)
              const key   = `${item.kind}:${anchorId(item)}`
              return (
                <div key={key} className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {anchorTitle(item)}
                    </span>
                  </div>
                  {flow && <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{flow}</p>}
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]" suppressHydrationWarning>
                    {ANCHOR_KIND_LABEL[item.kind]} · {formatDate(meta.date)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
