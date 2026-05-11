'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { DocCheckpoint } from '@/lib/db/documentation'

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

function DetailPanel({ cp, userName, onClose }: { cp: DocCheckpoint; userName: string; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col border-l border-gray-800 bg-gray-950">
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white leading-tight">{cp.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{cp.workspace_name} · {cp.team_name}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Primary fields */}
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
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PURPOSE_BADGE[cp.purpose] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>
              {cp.purpose}
            </span>
          </Row>
        </div>

        {/* Secondary metadata */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Secondary Metadata</p>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 space-y-2.5">
            <MetaRow label="Team"      value={cp.team_name} />
            <MetaRow label="Object Type" value={cp.object_type} />
            <MetaRow label="Project"   value={cp.project_name} />
            <MetaRow label="Workspace" value={cp.workspace_name} />
            <MetaRow label="Checkpoint ID" value={cp.id} mono />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <a
            href={`/workspace/${cp.workspace_id}`}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Open Document
          </a>
          <a
            href="/audit"
            className="flex-1 text-center text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 py-2 rounded-lg transition-colors"
          >
            View in Audit Log
          </a>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children, suppressWarn }: { label: string; children: React.ReactNode; suppressWarn?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-600 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-gray-300 leading-relaxed" suppressHydrationWarning={suppressWarn}>{children}</span>
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

interface Props {
  checkpoints:        DocCheckpoint[]
  userName:           string
  userEmail:          string
  externalSelectedId?: string | null
  onFilterChange?:    (filtered: DocCheckpoint[]) => void
}

export default function RepositoryView({ checkpoints, userName, externalSelectedId, onFilterChange }: Props) {
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

  const filtered = useMemo(() => checkpoints.filter(c => {
    if (filterProject && c.project_id !== filterProject) return false
    if (filterTeam    && c.team_id    !== filterTeam)    return false
    if (filterType    && c.purpose    !== filterType)    return false
    if (filterState   && c.doc_state  !== filterState)   return false
    if (filterDate    && !c.created_at.startsWith(filterDate)) return false
    return true
  }), [checkpoints, filterProject, filterTeam, filterType, filterState, filterDate])

  // Notify parent when filters change — skip initial mount (parent initializes with full list)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    onFilterChange?.(filtered)
  }, [filtered, onFilterChange])

  const selected = selectedId ? checkpoints.find(c => c.id === selectedId) ?? null : null

  const stats = {
    results:    filtered.length,
    saved:      checkpoints.filter(c => c.purpose === 'Checkpoint').length,
    underReview:checkpoints.filter(c => c.doc_state === 'under_review').length,
    controlled: checkpoints.filter(c => c.doc_state === 'locked').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-gray-800">
        <StatCard label="Results"      value={stats.results} />
        <StatCard label="Saved Objects" value={stats.saved} />
        <StatCard label="Under Review" value={stats.underReview} />
        <StatCard label="Controlled"   value={stats.controlled} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left: filters + list */}
        <div className={`flex flex-col ${selected ? 'w-1/2' : 'flex-1'} min-w-0 border-r border-gray-800`}>
          {/* Filters */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex flex-wrap gap-2">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
              <option value="">All projects</option>
              {uniqueProjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
              <option value="">All teams</option>
              {uniqueTeams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
              <option value="">All types</option>
              {['Checkpoint', 'Session Backup', 'Handoff', 'Evidence'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
              <option value="">All states</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500" />
            {(filterProject || filterTeam || filterType || filterState || filterDate) && (
              <button onClick={() => { setFilterProject(''); setFilterTeam(''); setFilterType(''); setFilterState(''); setFilterDate('') }}
                className="text-xs text-gray-500 hover:text-gray-300 px-2">
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
                {filtered.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                    className={`px-4 py-4 cursor-pointer transition-colors hover:bg-gray-900/60 ${selectedId === c.id ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.team_name} · {c.workspace_name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PURPOSE_BADGE[c.purpose] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>
                            {c.purpose}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold uppercase ${STATE_BADGE[c.doc_state] ?? STATE_BADGE.active}`}>
                            {c.doc_state.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5" suppressHydrationWarning>{formatDate(c.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedId(c.id) }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="w-1/2 min-w-0 overflow-hidden">
            <DetailPanel cp={selected} userName={userName} onClose={() => setSelectedId(null)} />
          </div>
        )}

        {!selected && (
          <div className="hidden md:flex flex-1 items-center justify-center text-gray-700 text-sm">
            Select a document to view details
          </div>
        )}
      </div>
    </div>
  )
}
