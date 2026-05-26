'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { DocCheckpoint, DocHandoffPackage } from '@/lib/db/documentation'

// ── Discriminated union for the unified list ──────────────────────────────
type ListItem =
  | { kind: 'checkpoint'; cp: DocCheckpoint }
  | { kind: 'handoff';    hp: DocHandoffPackage }

function itemId(item: ListItem)   { return item.kind === 'checkpoint' ? item.cp.id   : item.hp.id }
function itemDate(item: ListItem) { return item.kind === 'checkpoint' ? item.cp.created_at : item.hp.created_at }

// ── Badge maps ────────────────────────────────────────────────────────────
const PURPOSE_BADGE: Record<string, string> = {
  'Checkpoint':     'text-green-400 bg-green-950 border-green-900',
  'Session Backup': 'text-blue-400 bg-blue-950 border-blue-900',
  'Handoff':        'text-purple-400 bg-purple-950 border-purple-900',
  'Evidence':       'text-orange-400 bg-orange-950 border-orange-900',
}

const STATE_BADGE: Record<string, string> = {
  'active':       'text-emerald-400 bg-emerald-950 border-emerald-900',
  'under_review': 'text-yellow-400 bg-yellow-950 border-yellow-900',
  'locked':       'text-red-400 bg-red-950 border-red-900',
}

const STATUS_BADGE: Record<string, string> = {
  draft:    'text-gray-400 bg-gray-50 border-gray-200',
  sent:     'text-blue-400 bg-blue-950 border-blue-900',
  received: 'text-green-400 bg-green-950 border-green-900',
  archived: 'text-gray-500 bg-gray-50 border-gray-200',
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

const HANDOFF_BADGE = 'text-purple-300 bg-purple-950 border-purple-800'

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

// ── Detail panels ─────────────────────────────────────────────────────────
function Row({ label, children, suppressWarn }: { label: string; children: React.ReactNode; suppressWarn?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-600 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-gray-600 leading-relaxed" suppressHydrationWarning={suppressWarn}>{children}</span>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-xs text-gray-400 truncate max-w-[160px] ${mono ? 'font-mono' : ''}`} title={value}>{value}</span>
    </div>
  )
}

function CheckpointDetailPanel({ cp, userName, onClose, teamCodes }: { cp: DocCheckpoint; userName: string; onClose: () => void; teamCodes?: Record<string, string> }) {
  return (
    <div className="h-full flex flex-col border-l border-gray-800 bg-gray-950">
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white leading-tight">{cp.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{cp.workspace_name} · {teamLabel(cp.team_id, cp.team_name, teamCodes)}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-600 text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="space-y-3">
          <Row label="State">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase ${STATE_BADGE[cp.doc_state] ?? STATE_BADGE.active}`}>
              {cp.doc_state.replace('_', ' ')}
            </span>
          </Row>
          <Row label="Version">{cp.version_label}</Row>
          <Row label="Created" suppressWarn>{formatDate(cp.created_at)}</Row>
          <Row label="Owner">{userName}</Row>
          <Row label="Responsible">{cp.responsible ?? userName}</Row>
          <Row label="Sensitivity">
            <span className="text-xs text-gray-400 uppercase tracking-wide">{cp.sensitivity}</span>
          </Row>
          <Row label="Object type">
            <span className="text-xs text-gray-400 capitalize">{cp.object_type}</span>
          </Row>
          <Row label="Purpose">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PURPOSE_BADGE[cp.purpose] ?? 'text-gray-400 bg-gray-50 border-gray-200'}`}>
              {cp.purpose}
            </span>
          </Row>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Secondary Metadata</p>
          <div className="bg-white border border-gray-800 rounded-xl px-4 py-3 space-y-2.5">
            <MetaRow label="Team"         value={teamLabel(cp.team_id, cp.team_name, teamCodes)} />
            <MetaRow label="Object Type"  value={cp.object_type} />
            <MetaRow label="Project"      value={cp.project_name} />
            <MetaRow label="Workspace"    value={cp.workspace_name} />
            <MetaRow label="Checkpoint ID" value={cp.id} mono />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <a
            href={`/workspace/${cp.workspace_id}`}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Open Document
          </a>
          <a
            href="/audit"
            className="flex-1 text-center text-xs border border-gray-200 hover:border-gray-500 text-gray-400 hover:text-gray-800 py-2 rounded-lg transition-colors"
          >
            View in Audit Log
          </a>
        </div>
      </div>
    </div>
  )
}

function HandoffDetailPanel({ hp, onClose }: { hp: DocHandoffPackage; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col border-l border-gray-800 bg-gray-950">
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-bold uppercase ${HANDOFF_BADGE}`}>
              Handoff
            </span>
            <h3 className="text-sm font-bold text-white leading-tight">{hp.name}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{hp.workspace_name}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-600 text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-3">
          <Row label="From → To">
            <span className="font-medium">{AGENT_LABEL[hp.from_agent] ?? hp.from_agent}</span>
            <span className="text-gray-500"> → </span>
            <span className="font-medium">{AGENT_LABEL[hp.to_agent] ?? hp.to_agent}</span>
          </Row>
          <Row label="Status">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase ${STATUS_BADGE[hp.status] ?? STATUS_BADGE.draft}`}>
              {hp.status}
            </span>
          </Row>
          <Row label="Created" suppressWarn>{formatDate(hp.created_at)}</Row>
          <Row label="Messages">
            {hp.message_count} message{hp.message_count !== 1 ? 's' : ''} included
          </Row>
          <Row label="Workspace">{hp.workspace_name}</Row>
        </div>

        {hp.context && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Context</p>
            <p className="text-xs text-gray-600 leading-relaxed bg-white border border-gray-800 rounded-xl px-4 py-3">
              {hp.context}
            </p>
          </div>
        )}

        <div className="pt-1">
          <a
            href="/audit"
            className="block text-center text-xs border border-gray-200 hover:border-gray-500 text-gray-400 hover:text-gray-800 py-2 rounded-lg transition-colors"
          >
            View in Audit Log
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
interface Props {
  checkpoints:         DocCheckpoint[]
  handoffPackages:     DocHandoffPackage[]
  userName:            string
  userEmail:           string
  externalSelectedId?: string | null
  onFilterChange?:     (filtered: DocCheckpoint[]) => void
  teamCodes?:          Record<string, string>
}

export default function RepositoryView({
  checkpoints, handoffPackages, userName, externalSelectedId, onFilterChange, teamCodes,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (externalSelectedId) setSelectedId(externalSelectedId)
  }, [externalSelectedId])

  const [filterProject, setFilterProject] = useState('')
  const [filterTeam,    setFilterTeam]    = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterState,   setFilterState]   = useState('')
  const [filterDate,    setFilterDate]    = useState('')

  const uniqueProjects = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.project_id, c.project_name])).entries()), [checkpoints])
  const uniqueTeams    = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.team_id, c.team_name])).entries()), [checkpoints])

  const allItems = useMemo((): ListItem[] => {
    const cps: ListItem[] = checkpoints.map(cp => ({ kind: 'checkpoint', cp }))
    const hps: ListItem[] = handoffPackages.map(hp => ({ kind: 'handoff', hp }))
    return [...cps, ...hps].sort((a, b) => itemDate(b).localeCompare(itemDate(a)))
  }, [checkpoints, handoffPackages])

  const filtered = useMemo(() => allItems.filter(item => {
    // Date filter applies to everything
    if (filterDate) {
      if (!itemDate(item).startsWith(filterDate)) return false
    }

    if (item.kind === 'handoff') {
      // Handoffs appear only when type filter is unset or explicitly "Handoff Package"
      return !filterType || filterType === 'Handoff Package'
    }

    // Checkpoint-specific filters
    const c = item.cp
    if (filterProject && c.project_id !== filterProject) return false
    if (filterTeam    && c.team_id    !== filterTeam)    return false
    if (filterType && filterType !== 'Handoff Package' && c.purpose !== filterType) return false
    if (filterState   && c.doc_state  !== filterState)   return false
    return true
  }), [allItems, filterProject, filterTeam, filterType, filterState, filterDate])

  // Notify parent with filtered checkpoints only (SM Panel context)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    const filteredCps = filtered
      .filter((item): item is { kind: 'checkpoint'; cp: DocCheckpoint } => item.kind === 'checkpoint')
      .map(item => item.cp)
    onFilterChange?.(filteredCps)
  }, [filtered, onFilterChange])

  const selectedItem = useMemo(() =>
    selectedId ? allItems.find(item => itemId(item) === selectedId) ?? null : null
  , [selectedId, allItems])

  const stats = {
    results:     filtered.length,
    checkpoints: checkpoints.length,
    handoffs:    handoffPackages.length,
    controlled:  checkpoints.filter(c => c.doc_state === 'locked').length,
  }

  function resetFilters() {
    setFilterProject(''); setFilterTeam(''); setFilterType(''); setFilterState(''); setFilterDate('')
  }
  const hasFilter = filterProject || filterTeam || filterType || filterState || filterDate

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-gray-800">
        <StatCard label="Results"        value={stats.results} />
        <StatCard label="Checkpoints"    value={stats.checkpoints} />
        <StatCard label="Handoff Pkgs"   value={stats.handoffs} />
        <StatCard label="Controlled"     value={stats.controlled} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left: filters + list */}
        <div className={`flex flex-col ${selectedItem ? 'w-1/2' : 'flex-1'} min-w-0 border-r border-gray-800`}>
          {/* Filters */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex flex-wrap gap-2">
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
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All types</option>
              <option value="Checkpoint">Checkpoint</option>
              <option value="Session Backup">Session Backup</option>
              <option value="Handoff">Handoff</option>
              <option value="Evidence">Evidence</option>
              <option value="Handoff Package">Handoff Package</option>
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All states</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-600 px-2">
                Reset
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600 text-sm">No documents found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {filtered.map(item => {
                  const id       = itemId(item)
                  const isActive = selectedId === id
                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedId(isActive ? null : id)}
                      className={`px-4 py-4 cursor-pointer transition-colors hover:bg-white/60 ${isActive ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''}`}
                    >
                      {item.kind === 'checkpoint' ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.cp.name}</p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{teamLabel(item.cp.team_id, item.cp.team_name, teamCodes)} · {item.cp.workspace_name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PURPOSE_BADGE[item.cp.purpose] ?? 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                                  {item.cp.purpose}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold uppercase ${STATE_BADGE[item.cp.doc_state] ?? STATE_BADGE.active}`}>
                                  {item.cp.doc_state.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5" suppressHydrationWarning>{formatDate(item.cp.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedId(id) }}
                              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              View Details →
                            </button>
                            <a
                              href="/audit"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                            >
                              Audit Log →
                            </a>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-bold uppercase ${HANDOFF_BADGE}`}>
                                  HANDOFF
                                </span>
                                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.hp.name}</p>
                              </div>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.hp.workspace_name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                  {AGENT_LABEL[item.hp.from_agent] ?? item.hp.from_agent}
                                  {' → '}
                                  {AGENT_LABEL[item.hp.to_agent] ?? item.hp.to_agent}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold uppercase ${STATUS_BADGE[item.hp.status] ?? STATUS_BADGE.draft}`}>
                                  {item.hp.status}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5" suppressHydrationWarning>{formatDate(item.hp.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedId(id) }}
                              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              View Details →
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedItem && (
          <div className="w-1/2 min-w-0 overflow-hidden">
            {selectedItem.kind === 'checkpoint' && (
              <CheckpointDetailPanel cp={selectedItem.cp} userName={userName} onClose={() => setSelectedId(null)} teamCodes={teamCodes} />
            )}
            {selectedItem.kind === 'handoff' && (
              <HandoffDetailPanel hp={selectedItem.hp} onClose={() => setSelectedId(null)} />
            )}
          </div>
        )}

        {!selectedItem && (
          <div className="hidden md:flex flex-1 items-center justify-center text-gray-700 text-sm">
            Select a document to view details
          </div>
        )}
      </div>
    </div>
  )
}
