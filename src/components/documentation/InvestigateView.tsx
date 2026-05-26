'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { DocCheckpoint } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'

const PURPOSE_BADGE: Record<string, string> = {
  'Checkpoint':     'text-green-400 bg-green-950 border-green-900',
  'Session Backup': 'text-blue-400 bg-blue-950 border-blue-900',
  'Handoff':        'text-purple-400 bg-purple-950 border-purple-900',
  'Evidence':       'text-orange-400 bg-orange-950 border-orange-900',
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

interface Props {
  checkpoints: DocCheckpoint[]
  projects:    ProjectWithTeams[]
  userEmail:   string
  teamCodes?:  Record<string, string>
}

export default function InvestigateView({ checkpoints, userEmail, teamCodes }: Props) {
  const router = useRouter()
  const [search,         setSearch]         = useState('')
  const [filterProject,  setFilterProject]  = useState('')
  const [filterTeam,     setFilterTeam]     = useState('')
  const [filterType,     setFilterType]     = useState('')
  const [filterDate,     setFilterDate]     = useState('')

  const uniqueProjects = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.project_id, c.project_name])).entries()), [checkpoints])
  const uniqueTeams    = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.team_id, c.team_name])).entries()), [checkpoints])

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
      if (filterDate    && !c.created_at.startsWith(filterDate)) return false
      return true
    })
  }, [checkpoints, search, filterProject, filterTeam, filterType, filterDate])

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

  const stats = {
    threads:     checkpoints.length,
    timelineGroups: grouped.length,
    versioned:   checkpoints.filter(c => c.version_label && c.version_label !== 'v1').length,
    reviewPaths: checkpoints.filter(c => c.doc_state === 'under_review').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-gray-800">
        <StatCard label="Threads"        value={stats.threads} />
        <StatCard label="Timeline Groups" value={stats.timelineGroups} />
        <StatCard label="Versioned Docs" value={stats.versioned} />
        <StatCard label="Review Paths"   value={stats.reviewPaths} />
      </div>

      {/* Investigation focus */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Investigation Focus</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search a topic, actor, project, document, or linked trace…"
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <p className="text-xs text-gray-700 mt-1.5">
            Use this view to reconstruct an issue across related documents, not just to find one item.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            {['Checkpoint', 'Session Backup', 'Handoff', 'Evidence'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
          {(search || filterProject || filterTeam || filterType || filterDate) && (
            <button onClick={() => { setSearch(''); setFilterProject(''); setFilterTeam(''); setFilterType(''); setFilterDate('') }}
              className="text-xs text-gray-500 hover:text-gray-600 px-2">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {grouped.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600 text-sm">No documents match your search.</p>
          </div>
        ) : grouped.map(([day, items]) => (
          <div key={day} className="mb-8">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gray-50" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider" suppressHydrationWarning>
                {dateLabel(day + 'T12:00:00')}
              </p>
              <div className="h-px flex-1 bg-gray-50" />
            </div>

            <div className="space-y-3">
              {items.map(c => (
                <div key={c.id} className="bg-white border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PURPOSE_BADGE[c.purpose] ?? 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                          {c.purpose}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                        <InvMeta label="User"             value={userEmail} />
                        <InvMeta label="Last Responsible" value={c.responsible ?? userEmail} />
                        <InvMeta label="Document Type"    value={c.purpose} />
                        <InvMeta label="Latest Reference" value={formatDate(c.created_at)} suppress />
                        <InvMeta label="Investigation Lens" value={c.project_name} />
                        <InvMeta label="Related Actors"   value={`${teamLabel(c.team_id, c.team_name, teamCodes)} · ${c.workspace_name}`} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/workspace/${c.workspace_id}`)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-right"
                      >
                        Open Document →
                      </button>
                      <a href="/audit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-right">
                        Audit Log →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvMeta({ label, value, suppress }: { label: string; value: string; suppress?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-600 shrink-0">{label}:</span>
      <span className="text-xs text-gray-400 truncate" suppressHydrationWarning={!!suppress}>{value}</span>
    </div>
  )
}
