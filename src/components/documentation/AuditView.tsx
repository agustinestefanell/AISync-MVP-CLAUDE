'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { DocCheckpoint, DocAuditEvent } from '@/lib/db/documentation'

const EVENT_CONFIG: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  save_version:   { label: 'Save Version',        dotColor: 'bg-green-500',  badgeClass: 'text-green-400 bg-green-950 border-green-900' },
  session_backup: { label: 'Session Backup',       dotColor: 'bg-blue-500',   badgeClass: 'text-blue-400 bg-blue-950 border-blue-900' },
  resume_work:    { label: 'Resume Work',          dotColor: 'bg-indigo-500', badgeClass: 'text-indigo-400 bg-indigo-950 border-indigo-900' },
  lock:           { label: 'Lock',                 dotColor: 'bg-red-500',    badgeClass: 'text-red-400 bg-red-950 border-red-900' },
  unlock:         { label: 'Unlock',               dotColor: 'bg-gray-500',   badgeClass: 'text-gray-400 bg-gray-800 border-gray-700' },
  review_forward: { label: 'Review & Forward',     dotColor: 'bg-purple-500', badgeClass: 'text-purple-400 bg-purple-950 border-purple-900' },
}

const STATE_BADGE: Record<string, string> = {
  'active':       'text-emerald-400 bg-emerald-950 border-emerald-900',
  'under_review': 'text-yellow-400 bg-yellow-950 border-yellow-900',
  'locked':       'text-red-400 bg-red-950 border-red-900',
}

interface CheckpointMsg {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  position: number
  agent_sessions: { agent_role: string; provider: string; model: string } | null
}

const AGENT_LABEL: Record<string, string> = { manager: 'Manager', worker1: 'Worker 1', worker2: 'Worker 2' }

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

interface Props {
  checkpoints: DocCheckpoint[]
  auditEvents: DocAuditEvent[]
}

export default function AuditView({ checkpoints, auditEvents }: Props) {
  const router = useRouter()
  const [filterState,  setFilterState]  = useState('')
  const [filterEvent,  setFilterEvent]  = useState('')
  const [filterTeam,   setFilterTeam]   = useState('')
  const [filterDate,   setFilterDate]   = useState('')

  const [detailCpId,    setDetailCpId]    = useState<string | null>(null)
  const [detailWsId,    setDetailWsId]    = useState<string | null>(null)
  const [detailName,    setDetailName]    = useState('')
  const [detailMsgs,    setDetailMsgs]    = useState<CheckpointMsg[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Build checkpoint lookup map
  const cpMap = useMemo(() => new Map(checkpoints.map(c => [c.id, c])), [checkpoints])

  const uniqueTeams = useMemo(() =>
    Array.from(new Set(auditEvents.map(e => e.team_name).filter(Boolean) as string[])),
  [auditEvents])

  const filtered = useMemo(() => auditEvents.filter(e => {
    const cpId = e.metadata?.checkpoint_id as string | undefined
    const cp   = cpId ? cpMap.get(cpId) : null
    if (filterState && cp?.doc_state !== filterState)   return false
    if (filterEvent && e.event_type !== filterEvent)     return false
    if (filterTeam  && e.team_name  !== filterTeam)     return false
    if (filterDate  && !e.created_at.startsWith(filterDate)) return false
    return true
  }), [auditEvents, filterState, filterEvent, filterTeam, filterDate, cpMap])

  const stats = {
    records:    auditEvents.length,
    controlled: checkpoints.filter(c => c.doc_state === 'locked').length,
    linked:     auditEvents.filter(e => e.metadata?.checkpoint_id).length,
  }

  async function openDetail(e: DocAuditEvent) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId) return
    setDetailCpId(cpId)
    setDetailWsId(e.workspace_id)
    setDetailName((e.metadata?.name as string) ?? 'Checkpoint')
    setDetailLoading(true)
    setDetailMsgs([])
    const res  = await fetch(`/api/checkpoint/${cpId}`)
    const data = await res.json()
    setDetailMsgs(data)
    setDetailLoading(false)
  }

  const groups: Record<string, { agentRole: string; provider: string; model: string; messages: { role: string; content: string }[] }> = {}
  for (const msg of detailMsgs) {
    if (!groups[msg.session_id]) {
      groups[msg.session_id] = {
        agentRole: msg.agent_sessions?.agent_role ?? 'unknown',
        provider:  msg.agent_sessions?.provider ?? '',
        model:     msg.agent_sessions?.model ?? '',
        messages:  [],
      }
    }
    groups[msg.session_id].messages.push({ role: msg.role, content: msg.content })
  }
  const groupsArr = Object.values(groups)

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-3 gap-3 border-b border-gray-800">
        <StatCard label="Audit Records"  value={stats.records} />
        <StatCard label="Controlled Docs" value={stats.controlled} />
        <StatCard label="Audit Links"    value={stats.linked} />
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-800 flex flex-wrap gap-2">
        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
        </select>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
          <option value="">All events</option>
          {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500">
          <option value="">All teams</option>
          {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500" />
        {(filterState || filterEvent || filterTeam || filterDate) && (
          <button onClick={() => { setFilterState(''); setFilterEvent(''); setFilterTeam(''); setFilterDate('') }}
            className="text-xs text-gray-500 hover:text-gray-300 px-2">
            Reset Search
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600 text-sm">No audit records found.</p>
          </div>
        ) : filtered.map(e => {
          const cfg  = EVENT_CONFIG[e.event_type] ?? { label: e.event_type, dotColor: 'bg-gray-600', badgeClass: 'text-gray-400 bg-gray-800 border-gray-700' }
          const cpId = e.metadata?.checkpoint_id as string | undefined
          const cp   = cpId ? cpMap.get(cpId) : null
          const cpName = (e.metadata?.name as string) ?? (e.event_type === 'session_backup' ? 'Session Backup' : 'Session event')
          const actor  = (e.metadata?.from_agent ?? e.metadata?.agent_role) as string | undefined

          return (
            <div key={e.id} className="px-6 py-4 hover:bg-gray-900/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    {e.team_name && <span className="text-xs text-gray-600">{e.team_name}</span>}
                    {e.workspace_name && <span className="text-xs text-gray-600">· {e.workspace_name}</span>}
                  </div>
                  <p className="text-sm font-semibold text-white">{cpName}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                    {actor && <Meta label="Actor"      value={AGENT_LABEL[actor] ?? actor} />}
                    <Meta label="Reference Time" value={formatDate(e.created_at)} suppress />
                    <Meta label="Audit Linkage"  value={cpId ? '1 linked' : 'unlinked'} />
                    {cp && <Meta label="Document State" value={
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold uppercase ${STATE_BADGE[cp.doc_state] ?? STATE_BADGE.active}`}>
                        {cp.doc_state.replace('_',' ')}
                      </span>
                    } />}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {cpId && (
                    <button onClick={() => openDetail(e)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-right">
                      View Details →
                    </button>
                  )}
                  {e.workspace_id && (
                    <button onClick={() => router.push(`/workspace/${e.workspace_id}`)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-right">
                      Open Document →
                    </button>
                  )}
                  <a href="/audit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-right">
                    Audit Log →
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Checkpoint messages modal */}
      {detailCpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setDetailCpId(null) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate">{detailName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {detailLoading ? 'Loading…' : `${detailMsgs.length} messages · ${groupsArr.length} agent${groupsArr.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {detailWsId && (
                  <button
                    onClick={() => { router.push(`/workspace/${detailWsId}?checkpoint=${detailCpId}`); setDetailCpId(null) }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Resume →
                  </button>
                )}
                <button onClick={() => setDetailCpId(null)} className="text-gray-500 hover:text-gray-300 text-sm px-2">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-gray-500 text-sm animate-pulse">Loading messages…</span>
                </div>
              ) : groupsArr.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-8">No messages in this checkpoint.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupsArr.map((g, gi) => (
                    <div key={gi} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 shrink-0">
                        <p className="text-xs font-semibold text-gray-300">{AGENT_LABEL[g.agentRole] ?? g.agentRole}</p>
                        <p className="text-xs text-gray-500">{g.provider} · {g.model}</p>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                        {g.messages.map((msg, i) => (
                          <div key={i} className={`text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user' ? 'bg-indigo-900/50 text-indigo-100 ml-3' : 'bg-gray-700 text-gray-200 mr-3'
                          }`}>
                            <span className="font-medium text-gray-400 block mb-0.5">{msg.role === 'user' ? 'User' : 'Agent'}</span>
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value, suppress }: { label: string; value: React.ReactNode; suppress?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-600">{label}:</span>
      <span className="text-xs text-gray-400" suppressHydrationWarning={!!suppress}>{value}</span>
    </div>
  )
}
