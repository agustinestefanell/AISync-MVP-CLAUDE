'use client'

import { useState, useMemo } from 'react'
import type { DocCheckpoint, DocAuditEvent } from '@/lib/db/documentation'

const EVENT_CONFIG: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  save_version:   { label: 'Save Version',        dotColor: 'bg-green-500',  badgeClass: 'text-green-700 bg-green-50 border-green-200' },
  session_backup: { label: 'Session Backup',       dotColor: 'bg-blue-500',   badgeClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  resume_work:    { label: 'Resume Work',          dotColor: 'bg-indigo-500', badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  lock:           { label: 'Lock',                 dotColor: 'bg-red-500',    badgeClass: 'text-red-700 bg-red-50 border-red-200' },
  unlock:         { label: 'Unlock',               dotColor: 'bg-gray-500',   badgeClass: 'text-gray-600 bg-gray-50 border-gray-200' },
  review_forward: { label: 'Review & Forward',     dotColor: 'bg-purple-500', badgeClass: 'text-purple-700 bg-purple-50 border-purple-200' },
  save_selection: { label: 'Save Selection',       dotColor: 'bg-amber-500',  badgeClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  connection_accepted:     { label: 'Connection Accepted',     dotColor: 'bg-green-500', badgeClass: 'text-green-700 bg-green-50 border-green-200' },
  connection_disconnected: { label: 'Connection Disconnected', dotColor: 'bg-red-500',   badgeClass: 'text-red-700 bg-red-50 border-red-200' },
  connection_cancelled:    { label: 'Connection Cancelled',    dotColor: 'bg-gray-500',  badgeClass: 'text-gray-600 bg-gray-50 border-gray-200' },
}

const STATE_BADGE: Record<string, string> = {
  'active':       'text-emerald-700 bg-emerald-50 border-emerald-200',
  'under_review': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  'locked':       'text-red-700 bg-red-50 border-red-200',
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
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-5 py-4">
      <p className="ui-title text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="ui-label text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

interface Props {
  checkpoints: DocCheckpoint[]
  auditEvents: DocAuditEvent[]
  teamCodes?:  Record<string, string>
}

export default function AuditView({ checkpoints, auditEvents, teamCodes }: Props) {
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
    Array.from(
      new Map(
        auditEvents
          .filter(e => e.team_name && e.team_id)
          .map(e => [e.team_id, { id: e.team_id as string, name: e.team_name! }])
      ).values()
    ).sort((a, b) => {
      const codeA = teamCodes?.[a.id] ?? a.name
      const codeB = teamCodes?.[b.id] ?? b.name
      return codeA.localeCompare(codeB)
    }),
  [auditEvents, teamCodes])

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
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-3 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Audit Records"  value={stats.records} />
        <StatCard label="Controlled Docs" value={stats.controlled} />
        <StatCard label="Audit Links"    value={stats.linked} />
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border-default)] flex flex-wrap gap-2">
        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
        </select>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All events</option>
          {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All teams</option>
          {uniqueTeams.map(t => (
            <option key={t.id} value={t.name}>
              {teamCodes?.[t.id] ? `${teamCodes[t.id]} · ${t.name}` : t.name}
            </option>
          ))}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
        {(filterState || filterEvent || filterTeam || filterDate) && (
          <button onClick={() => { setFilterState(''); setFilterEvent(''); setFilterTeam(''); setFilterDate('') }}
            className="text-xs text-gray-500 hover:text-gray-600 px-2">
            Reset Search
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--color-text-muted)] text-sm">No audit records found.</p>
          </div>
        ) : (
          <div className="p-4 grid gap-3 content-start">
            {filtered.map(e => {
              const cfg       = EVENT_CONFIG[e.event_type] ?? { label: e.event_type, dotColor: 'bg-gray-600', badgeClass: 'text-gray-600 bg-gray-50 border-gray-200' }
              const cpId      = e.metadata?.checkpoint_id as string | undefined
              const cp        = cpId ? cpMap.get(cpId) : null
              const cpName    = (e.metadata?.name as string)
                ?? (e.event_type === 'attachment_uploaded' ? ((e.metadata?.filename as string) ?? 'File attached') : undefined)
                ?? (e.event_type === 'tool_call_executed'  ? ((e.metadata?.query as string)    ?? 'Web search')    : undefined)
                ?? (e.event_type === 'session_backup' ? 'Session Backup' : undefined)
                ?? (e.event_type === 'connection_accepted'     ? `Connected with ${(e.metadata?.requester_email as string) ?? (e.metadata?.partner_email as string) ?? 'partner'}` : undefined)
                ?? (e.event_type === 'connection_disconnected' ? `Disconnected from ${(e.metadata?.partner_email as string) ?? 'partner'}` : undefined)
                ?? (e.event_type === 'connection_cancelled'    ? `Cancelled request to ${(e.metadata?.receiver_email as string) ?? 'receiver'}` : undefined)
                ?? 'Session event'
              const actor     = (e.metadata?.from_agent ?? e.metadata?.agent_role) as string | undefined
              const teamCode  = e.team_id ? teamCodes?.[e.team_id] : undefined
              const teamLabel = teamCode ? `${teamCode} · ${e.team_name}` : (e.team_name ?? '—')
              const docPath   = cp ? `${cp.project_name} / ${cp.team_name} / ${cp.workspace_name}` : e.workspace_name ?? '—'

              return (
                <div key={e.id} className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] overflow-hidden">
                  {/* Top strip */}
                  <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto]">
                    {/* Identity */}
                    <div className="min-w-0 border-[var(--color-border-subtle)] md:border-r md:pr-3">
                      <div className="flex items-start gap-2">
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2.75h5.25L15.5 7v10.25a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
                          <path d="M11 2.75V7h4.5" />
                          <path d="M7.5 10.25h5" />
                          <path d="M7.5 13h5" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{cpName}</div>
                          <div className="mt-0.5 truncate text-[11px] leading-5 text-[var(--color-text-secondary)]">
                            {[teamLabel, e.workspace_name, 'working-record'].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actor + User */}
                    <div className="grid gap-2">
                      <Field label="Actor" value={actor ? (AGENT_LABEL[actor] ?? actor) : 'n/a'} />
                      <Field label="User"  value={actor ? (AGENT_LABEL[actor] ?? actor) : 'n/a'} />
                    </div>

                    {/* Event Type + Source Workspace */}
                    <div className="grid gap-2">
                      <Field label="Event Type"       value={cfg.label} />
                      <Field label="Source Workspace" value={e.workspace_name ?? 'n/a'} />
                    </div>

                    {/* Reference Time + Audit Linkage */}
                    <div className="grid gap-2">
                      <Field label="Reference Time" value={formatDate(e.created_at)} suppress />
                      <Field label="Audit Linkage"  value={cpId ? '1 linked event' : 'n/a'} />
                    </div>

                    {/* Badges + Buttons */}
                    <div className="flex min-w-[160px] flex-col items-end justify-between gap-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {cp && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATE_BADGE[cp.doc_state] ?? STATE_BADGE.active}`}>
                            {cp.doc_state.replace('_', ' ')}
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {cpId && (
                          <button onClick={() => openDetail(e)}
                            className="ui-button min-h-7 px-3 text-[11px] text-[var(--color-text-secondary)]">
                            View Details
                          </button>
                        )}
                        {e.workspace_id && (
                          <button onClick={() => window.open(`/workspace/${e.workspace_id}`, '_blank', 'noopener,noreferrer')}
                            className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40">
                            Open Document →
                          </button>
                        )}
                        <button onClick={() => window.open('/audit', '_blank', 'noopener,noreferrer')}
                          className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40">
                          View in Audit Log →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom strip */}
                  <div className="grid gap-x-4 gap-y-1.5 border-t border-[var(--color-border-subtle)] px-4 py-2.5 sm:grid-cols-3">
                    <Field label="Document State"   value={cp ? cp.doc_state.replace('_', ' ') : 'n/a'} />
                    <Field label="Document Version" value={cp?.version_label ?? 'v1'} />
                    <Field label="PATH"             value={docPath} long />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Checkpoint messages modal */}
      {detailCpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setDetailCpId(null) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-default)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">{detailName}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {detailLoading ? 'Loading…' : `${detailMsgs.length} messages · ${groupsArr.length} agent${groupsArr.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {detailWsId && (
                  <button
                    onClick={() => window.open(`/workspace/${detailWsId}?checkpoint=${detailCpId}`, '_blank', 'noopener,noreferrer')}
                    className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                  >
                    Resume →
                  </button>
                )}
                <button onClick={() => setDetailCpId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-[var(--color-text-muted)] text-sm animate-pulse">Loading messages…</span>
                </div>
              ) : groupsArr.length === 0 ? (
                <p className="text-center text-[var(--color-text-muted)] text-sm py-8">No messages in this checkpoint.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupsArr.map((g, gi) => (
                    <div key={gi} className="bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3 py-2 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] shrink-0">
                        <p className="text-xs font-semibold text-[var(--color-text-primary)]">{AGENT_LABEL[g.agentRole] ?? g.agentRole}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{g.provider} · {g.model}</p>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                        {g.messages.map((msg, i) => (
                          <div key={i} className={`text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user' ? 'bg-[var(--color-badge-structural-bg)] text-[var(--color-text-primary)] ml-3' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] mr-3'
                          }`}>
                            <span className="font-medium text-[var(--color-text-muted)] block mb-0.5">{msg.role === 'user' ? 'User' : 'Agent'}</span>
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

function _Meta({ label, value, suppress }: { label: string; value: React.ReactNode; suppress?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="ui-meta text-xs text-[var(--color-text-secondary)]">{label}:</span>
      <span className="text-xs text-[var(--color-text-primary)]" suppressHydrationWarning={!!suppress}>{value}</span>
    </div>
  )
}

function Field({ label, value, suppress, long }: { label: string; value: string; suppress?: boolean; long?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
      <div className={`text-xs leading-[1.5] text-[var(--color-text-primary)]${long ? ' break-all' : ''}`} suppressHydrationWarning={!!suppress}>{value}</div>
    </div>
  )
}
