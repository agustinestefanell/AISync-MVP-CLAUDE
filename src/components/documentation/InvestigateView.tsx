'use client'

import { useState, useMemo } from 'react'
import type { DocCheckpoint, DocHandoffPackage, DocSavedSelection } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'

const PURPOSE_BADGE: Record<string, string> = {
  'Checkpoint':     'text-green-700 bg-green-50 border-green-200',
  'Session Backup': 'text-blue-700 bg-blue-50 border-blue-200',
  'Handoff':        'text-purple-700 bg-purple-50 border-purple-200',
  'Evidence':       'text-orange-700 bg-orange-50 border-orange-200',
}

const PURPOSE_LABELS: Record<string, string> = {
  'Checkpoint':           'Checkpoint',
  'Handoff':              'Handoff',
  'Session Backup':       'Session Backup',
  'Evidence':             'Evidence',
  'Documentación':        'Documentation',
  'Retomar después':      'Resume Later',
  'Soporte de auditoría': 'Audit Support',
  'Evidencia':            'Evidence',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function teamLabel(id: string, name: string, codes?: Record<string, string>): string {
  const code = codes?.[id]
  return code ? `${code} · ${name}` : name
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function getTimelineSpan(items: DocCheckpoint[]): string {
  const dates = items
    .map(c => c.created_at ? new Date(c.created_at) : null)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (!dates.length) return '—'
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  const first = dates[0]
  const last  = dates[dates.length - 1]
  if (first.toDateString() === last.toDateString()) return fmt(first)
  return `${fmt(first)} → ${fmt(last)}`
}

function getRelatedPieces(items: DocCheckpoint[]): number {
  if (!items.length) return 0
  const anchor = items[0]
  return items.filter(c =>
    (anchor.team_id && c.team_id === anchor.team_id) ||
    (anchor.workspace_id && c.workspace_id === anchor.workspace_id)
  ).length
}

function getRelatedActors(items: DocCheckpoint[]): number {
  return new Set(
    items.map(c => c.responsible).filter((v): v is string => Boolean(v?.trim()))
  ).size
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
  checkpoints:     DocCheckpoint[]
  handoffPackages: DocHandoffPackage[]
  savedSelections: DocSavedSelection[]
  projects:        ProjectWithTeams[]
  userEmail:       string
  teamCodes?:      Record<string, string>
}

export default function InvestigateView({ checkpoints, handoffPackages, savedSelections, userEmail, teamCodes }: Props) {
  const [search,         setSearch]         = useState('')
  const [filterProject,  setFilterProject]  = useState('')
  const [filterTeam,     setFilterTeam]     = useState('')
  const [filterType,     setFilterType]     = useState('')
  const [filterArchiveStatus, setFilterArchiveStatus] = useState('')
  const [filterDate,     setFilterDate]     = useState('')

  const uniqueProjects = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.project_id, c.project_name])).entries()), [checkpoints])
  const uniqueTeams    = useMemo(() => {
    const m = new Map<string, string>()
    checkpoints.forEach(c => { if (c.team_id) m.set(c.team_id, c.team_name ?? '') })
    handoffPackages.forEach(h => { if (h.team_id) m.set(h.team_id, h.team_name ?? '') })
    return Array.from(m.entries()).sort(([idA, nameA], [idB, nameB]) => {
      const codeA = teamCodes?.[idA] ?? nameA
      const codeB = teamCodes?.[idB] ?? nameB
      return codeA.localeCompare(codeB)
    })
  }, [checkpoints, handoffPackages, teamCodes])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return checkpoints.filter(c => {
      if (search && !c.name.toLowerCase().includes(q) &&
          !c.team_name.toLowerCase().includes(q) &&
          !c.project_name.toLowerCase().includes(q) &&
          !c.workspace_name.toLowerCase().includes(q)) return false
      if (filterProject && c.project_id !== filterProject) return false
      if (filterTeam    && c.team_id    !== filterTeam)    return false
      if (filterType    && c.purpose    !== filterType)    return false
      if (filterArchiveStatus && c.team_status !== filterArchiveStatus) return false
      if (filterDate    && !c.created_at.startsWith(filterDate)) return false
      return true
    })
  }, [checkpoints, search, filterProject, filterTeam, filterType, filterArchiveStatus, filterDate])

  // Group by date (YYYY-MM-DD)
  const grouped = useMemo(() => {
    const map = new Map<string, DocCheckpoint[]>()
    for (const c of filtered) {
      const day = c.created_at.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(c)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const investigationContext = useMemo(() => ({
    timelineSpan:  getTimelineSpan(filtered),
    relatedPieces: getRelatedPieces(filtered),
    relatedActors: getRelatedActors(filtered),
  }), [filtered])

  const stats = {
    threads:     checkpoints.length,
    timelineGroups: grouped.length,
    versioned:   checkpoints.filter(c => c.version_label && c.version_label !== 'v1').length,
    reviewPaths: checkpoints.filter(c => c.doc_state === 'under_review').length,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Threads"        value={stats.threads} />
        <StatCard label="Timeline Groups" value={stats.timelineGroups} />
        <StatCard label="Versioned Docs" value={stats.versioned} />
        <StatCard label="Review Paths"   value={stats.reviewPaths} />
      </div>

      {/* Investigation focus */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-default)] space-y-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Investigation Focus</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search a topic, actor, project, document, or linked trace…"
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            Use this view to reconstruct an issue across related documents, not just to find one item.
          </p>
        </div>
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
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
            <option value="">All types</option>
            {['Checkpoint', 'Session Backup', 'Handoff', 'Evidence', 'Saved Selection'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterArchiveStatus} onChange={e => setFilterArchiveStatus(e.target.value)}
            className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
            <option value="">All team statuses</option>
            <option value="active">Active teams</option>
            <option value="archived">Archived teams</option>
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]" />
          {(search || filterProject || filterTeam || filterType || filterArchiveStatus || filterDate) && (
            <button onClick={() => { setSearch(''); setFilterProject(''); setFilterTeam(''); setFilterType(''); setFilterArchiveStatus(''); setFilterDate('') }}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Investigation Context */}
      <div className="shrink-0 px-6 pb-4">
        <section className="bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[14px] px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Investigation Context</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Calculated from the active filtered checkpoint set.</p>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Timeline Span</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]" suppressHydrationWarning>{investigationContext.timelineSpan}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Related Pieces</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{investigationContext.relatedPieces}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Related Actors</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{investigationContext.relatedActors}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {filterType === 'Saved Selection' ? (
          savedSelections.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--color-text-muted)] text-sm">No saved selections found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSelections.map(s => (
                <SavedSelectionCard key={s.id} s={s} />
              ))}
            </div>
          )
        ) : (
          <>
            {grouped.length === 0 && (filterType !== '' || savedSelections.length === 0) ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[var(--color-text-muted)] text-sm">No documents match your search.</p>
              </div>
            ) : (
              <>
                {grouped.map(([day, items]) => (
          <div key={day} className="mb-8">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" suppressHydrationWarning>
                {dateLabel(day + 'T12:00:00')}
              </p>
              <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            </div>

            <div className="space-y-3">
              {items.map(c => (
                <div key={c.id} className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-[14px] px-4 py-3 hover:border-[var(--color-border-focus)] transition-colors">
                  {/* Top: icon + title + purpose badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2.75h5.25L15.5 7v10.25a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
                        <path d="M11 2.75V7h4.5" />
                        <path d="M7.5 10.25h5" />
                        <path d="M7.5 13h5" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-snug">{c.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{c.project_name} · {teamLabel(c.team_id, c.team_name, teamCodes)} · {c.workspace_name}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${PURPOSE_BADGE[c.purpose] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                      {PURPOSE_LABELS[c.purpose] ?? c.purpose}
                    </span>
                  </div>
                  {/* Metadata grid */}
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                    <InvMeta label="User"               value={userEmail} />
                    <InvMeta label="Last Responsible"   value={c.responsible ?? userEmail} />
                    <InvMeta label="Document Type"      value={PURPOSE_LABELS[c.purpose] ?? c.purpose} />
                    <InvMeta label="Latest Reference"   value={formatDate(c.created_at)} suppress />
                    <InvMeta label="Investigation Lens" value={c.project_name} />
                    <InvMeta label="Related Actors"     value={`${teamLabel(c.team_id, c.team_name, teamCodes)} · ${c.workspace_name}`} />
                  </div>
                  {/* Bottom strip: buttons */}
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--color-border-subtle)] pt-2">
                    <button
                      onClick={() => window.open(`/workspace/${c.workspace_id}`, '_blank', 'noopener,noreferrer')}
                      className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                    >
                      Open Document →
                    </button>
                    <button
                      onClick={() => window.open('/audit', '_blank', 'noopener,noreferrer')}
                      className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                    >
                      View in Audit Log →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
                ))}
                {filterType === '' && savedSelections.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Saved Selections</p>
                      <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
                    </div>
                    <div className="space-y-3">
                      {savedSelections.map(s => (
                        <SavedSelectionCard key={s.id} s={s} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SavedSelectionCard({ s }: { s: import('@/lib/db/documentation').DocSavedSelection }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-[14px] px-4 py-3 hover:border-[var(--color-border-focus)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase mr-1.5 text-amber-700 bg-amber-50 border-amber-200">SAVED SELECTION</span>
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{s.name}</span>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{s.workspace_name}{s.team_name ? ` · ${s.team_name}` : ''}</p>
        </div>
        <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase text-amber-700 bg-amber-50 border-amber-200">
          {s.messages.length} msgs
        </span>
      </div>
      <div className="mt-2 flex gap-x-6 gap-y-0.5 flex-wrap border-t border-[var(--color-border-subtle)] pt-2">
        <InvMeta label="Workspace" value={s.workspace_name} />
        {s.team_name && <InvMeta label="Team" value={s.team_name} />}
        <InvMeta label="Created" value={new Date(s.created_at).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })} suppress />
      </div>
    </div>
  )
}

function InvMeta({ label, value, suppress }: { label: string; value: string; suppress?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="ui-meta text-xs text-[var(--color-text-secondary)] shrink-0">{label}:</span>
      <span className="text-xs text-[var(--color-text-primary)] truncate" suppressHydrationWarning={!!suppress}>{value}</span>
    </div>
  )
}
