'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AuditEventRow } from '@/lib/db/audit'
import { getProjectColorTokens, teamCodeToPaletteIndex } from '@/lib/teams/getProjectColor'

// ─── Row helper — metadata rows for side panel ───────────────────────────────

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-border)] py-2 text-sm">
      <span className="text-[var(--color-text-secondary)] shrink-0">{label}</span>
      <span className="text-[var(--color-text-primary)] text-right break-words">{children}</span>
    </div>
  )
}

// ─── Date helpers (ported from demo PageC.tsx — Date native, no libraries) ────

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function buildDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function addDays(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function addMonths(date: Date, n: number) {
  const d = new Date(date); d.setMonth(d.getMonth() + n); return d
}
function getStartOfWeek(date: Date) {
  const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d
}
function isSameDay(a: Date, b: Date) { return buildDateKey(a) === buildDateKey(b) }
function getMonthCells(date: Date): (Date | null)[] {
  const y = date.getFullYear(), m = date.getMonth()
  const firstWeekday = new Date(y, m, 1).getDay()
  const daysInMonth  = new Date(y, m + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
function formatPeriodLabel(date: Date, view: ViewMode) {
  if (view === 'month') return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
  if (view === 'week') {
    const s = getStartOfWeek(date), e = addDays(s, 6)
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day'
type NormalizedEvent = AuditEventRow & { date: string; time: string }

interface CheckpointMsg {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  position: number
  agent_sessions: { agent_role: string; provider: string; model: string } | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  save_version:   { label: 'Checkpoint saved',   badgeClass: 'text-green-400 bg-green-950 border-green-900' },
  session_backup: { label: 'Session Backup',      badgeClass: 'text-blue-400 bg-blue-950 border-blue-900' },
  resume_work:    { label: 'Resume Work',         badgeClass: 'text-indigo-400 bg-indigo-950 border-indigo-900' },
  lock:           { label: 'Workspace locked',    badgeClass: 'text-red-400 bg-red-950 border-red-900' },
  unlock:         { label: 'Workspace unlocked',  badgeClass: 'text-gray-400 bg-gray-50 border-gray-200' },
  review_forward: { label: 'Review & Forward',    badgeClass: 'text-purple-400 bg-purple-950 border-purple-900' },
  save_selection:      { label: 'Save Selection', badgeClass: 'text-amber-400 bg-amber-950 border-amber-900' },
  attachment_uploaded: { label: 'File Attached',  badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  tool_call_executed:  { label: 'Web Search',     badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
}
const AGENT_LABEL: Record<string, string> = { manager: 'Manager', worker1: 'Worker 1', worker2: 'Worker 2' }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function eventColors(e: NormalizedEvent, teamCodes?: Record<string, string>) {
  if (!e.team_id) return { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)', accent: '#64748b' }
  const code = teamCodes?.[e.team_id]
  const tok  = getProjectColorTokens(code ? teamCodeToPaletteIndex(code) : 0, 'team')
  return { bg: tok.bg, border: tok.border, accent: tok.accent }
}

function hasCheckpoint(e: AuditEventRow) {
  return (e.event_type === 'save_version' || e.event_type === 'resume_work') && !!e.metadata?.checkpoint_id
}

function eventTitle(e: AuditEventRow): string {
  const m = e.metadata ?? {}
  if (e.event_type === 'save_version')   return (m.name as string) ?? 'Unnamed checkpoint'
  if (e.event_type === 'session_backup') return 'Backup downloaded'
  if (e.event_type === 'resume_work')    return `Resumed "${(m.name as string) ?? 'checkpoint'}"`
  if (e.event_type === 'lock')           return 'Workspace locked'
  if (e.event_type === 'unlock')         return 'Workspace unlocked'
  if (e.event_type === 'review_forward')     return `Forwarded to ${(m.to_agent as string) ?? 'agent'}`
  if (e.event_type === 'attachment_uploaded') return (m.filename as string) ?? 'File attached'
  if (e.event_type === 'tool_call_executed')  return (m.query as string) ?? 'Web search executed'
  return e.event_type
}

function eventDetail(e: AuditEventRow): string | null {
  const m = e.metadata ?? {}
  if (e.event_type === 'save_version')   return [m.purpose, `${m.message_count ?? 0} msgs`].filter(Boolean).join(' · ')
  if (e.event_type === 'session_backup') return `${m.total_messages ?? 0} messages exported`
  if (e.event_type === 'review_forward')     return `${m.message_count ?? ''} message(s)`
  if (e.event_type === 'attachment_uploaded') return (m.mime_type as string) ?? (m.attachment_type as string) ?? null
  if (e.event_type === 'tool_call_executed')  return `${(m.tool_name as string) ?? 'web_search'} · ${(m.provider as string) ?? ''}`
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditTimeline({ events, externalDetailCpId, onFilterChange, teamCodes }: {
  events:               AuditEventRow[]
  externalDetailCpId?:  string | null
  onFilterChange?:      (filtered: AuditEventRow[]) => void
  teamCodes?:           Record<string, string>
}) {
  // Calendar state — focusDate starts null to avoid server/client hydration mismatch
  const [viewMode,  setViewMode]  = useState<ViewMode>('month')
  const [focusDate, setFocusDate] = useState<Date | null>(null)

  useEffect(() => {
    setFocusDate(events.length > 0 ? new Date(events[0].created_at) : new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter state
  const [filterType,   setFilterType]   = useState('all')
  const [filterTeamId, setFilterTeamId] = useState('all')

  // Side panel state
  const [selectedEvent, setSelectedEvent] = useState<NormalizedEvent | null>(null)

  // Detail modal state (preserved from original)
  const [detailCpId,    setDetailCpId]    = useState<string | null>(null)
  const [detailWsId,    setDetailWsId]    = useState<string | null>(null)
  const [detailName,    setDetailName]    = useState('')
  const [detailMsgs,    setDetailMsgs]    = useState<CheckpointMsg[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Normalize events: derive date/time from created_at
  const normalized = useMemo<NormalizedEvent[]>(() => events.map(e => ({
    ...e,
    date: e.created_at.slice(0, 10),
    time: e.created_at.slice(11, 16),
  })), [events])

  // Unique teams for filter dropdown
  const uniqueTeams = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of normalized) if (e.team_id && e.team_name) seen.set(e.team_id, e.team_name)
    const result: { id: string; name: string }[] = []
    seen.forEach((name, id) => result.push({ id, name }))
    return result.sort((a, b) => (teamCodes?.[a.id] ?? a.name).localeCompare(teamCodes?.[b.id] ?? b.name))
  }, [normalized, teamCodes])

  // Apply filters
  const filtered = useMemo(() => normalized.filter(e => {
    if (filterType   !== 'all' && e.event_type !== filterType)   return false
    if (filterTeamId !== 'all' && e.team_id    !== filterTeamId) return false
    return true
  }), [normalized, filterType, filterTeamId])

  // Report filtered list to parent for SM panel context
  useEffect(() => { onFilterChange?.(filtered) }, [filtered]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open detail modal from SMPanel external trigger
  useEffect(() => {
    if (!externalDetailCpId) return
    const ev = events.find(e => (e.metadata?.checkpoint_id as string) === externalDetailCpId)
    if (ev) openDetail(ev)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDetailCpId])

  // Group filtered events by date for calendar rendering
  const byDate = useMemo(() => {
    const map = new Map<string, NormalizedEvent[]>()
    for (const e of filtered) {
      const list = map.get(e.date) ?? []
      map.set(e.date, [...list, e].sort((a, b) => a.time.localeCompare(b.time)))
    }
    return map
  }, [filtered])

  // Derived calendar data — return empty arrays when focusDate is null (no new Date() during SSR)
  const monthCells = useMemo(() => focusDate ? getMonthCells(focusDate) : [], [focusDate])
  const weekDates  = useMemo(() => {
    if (!focusDate) return []
    const start = getStartOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [focusDate])
  const dayEvents = focusDate ? (byDate.get(buildDateKey(focusDate)) ?? []) : []

  // Navigation (ported from demo PageC.tsx goToPrevious / goToNext / resetFocus)
  const goToPrev = () => {
    if (viewMode === 'month') setFocusDate(d => addMonths(d ?? new Date(), -1))
    else if (viewMode === 'week') setFocusDate(d => addDays(d ?? new Date(), -7))
    else setFocusDate(d => addDays(d ?? new Date(), -1))
  }
  const goToNext = () => {
    if (viewMode === 'month') setFocusDate(d => addMonths(d ?? new Date(), 1))
    else if (viewMode === 'week') setFocusDate(d => addDays(d ?? new Date(), 7))
    else setFocusDate(d => addDays(d ?? new Date(), 1))
  }

  // Detail modal handlers (preserved from original AuditTimeline)
  async function openDetail(e: AuditEventRow) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId) return
    setDetailCpId(cpId)
    setDetailWsId(e.workspace_id)
    setDetailName(eventTitle(e))
    setDetailLoading(true)
    setDetailMsgs([])
    const res = await fetch(`/api/checkpoint/${cpId}`)
    setDetailMsgs(await res.json())
    setDetailLoading(false)
  }
  function closeDetail() { setDetailCpId(null); setDetailMsgs([]) }
  function _retomar(e: AuditEventRow) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId || !e.workspace_id) return
    window.open(`/workspace/${e.workspace_id}?checkpoint=${cpId}`, '_blank', 'noopener,noreferrer')
  }

  // Team label helper: "A-01 · Team Name" or just name
  function teamLabel(e: NormalizedEvent): string | null {
    if (!e.team_id) return null
    const code = teamCodes?.[e.team_id]
    return code ? `${code} · ${e.team_name}` : e.team_name
  }

  // ─── Render: Month chip (ported from demo renderMonthEvent) ──────────────

  function renderMonthChip(event: NormalizedEvent) {
    const c   = eventColors(event, teamCodes)
    const cfg = EVENT_CONFIG[event.event_type]
    const code = event.team_id ? teamCodes?.[event.team_id] : undefined
    return (
      <button
        key={event.id}
        className="w-full truncate rounded-[5px] border px-1 py-0.5 text-left text-[9px] font-medium leading-tight"
        style={{ borderColor: c.border, backgroundColor: c.bg, color: '#1e293b' }}
        onClick={ev => { ev.stopPropagation(); setFocusDate(new Date(event.date)); setViewMode('day') }}
        title={`${event.time} ${cfg?.label ?? event.event_type}`}
      >
        <span className="font-semibold mr-0.5">{event.time}</span>
        {code && <span className="mr-0.5 opacity-80">{code}</span>}
        {cfg?.label ?? event.event_type}
      </button>
    )
  }

  // ─── Render: Week card (ported from demo renderWeekEvent) ────────────────

  function renderWeekCard(event: NormalizedEvent) {
    const c   = eventColors(event, teamCodes)
    const cfg = EVENT_CONFIG[event.event_type]
    const tl  = teamLabel(event)
    return (
      <button
        key={event.id}
        className="w-full rounded-[10px] border bg-white px-2.5 py-2 text-left text-xs"
        style={{ borderColor: c.border, boxShadow: `inset 0 2px 0 ${c.accent}` }}
        onClick={ev => { ev.stopPropagation(); setSelectedEvent(event) }}
      >
        <div className="font-semibold text-neutral-900">{event.time}</div>
        <div className="mt-0.5 font-medium text-neutral-800 truncate">{cfg?.label ?? event.event_type}</div>
        {tl && <div className="mt-0.5 truncate text-[10px]" style={{ color: c.accent }}>{tl}</div>}
      </button>
    )
  }

  // ─── Render: Day card (ported from demo renderDayEvent) ──────────────────

  function renderDayCard(event: NormalizedEvent) {
    const c   = eventColors(event, teamCodes)
    const cfg = EVENT_CONFIG[event.event_type]
    const tl  = teamLabel(event)
    const det = eventDetail(event)
    const cp  = hasCheckpoint(event)
    return (
      <div
        key={event.id}
        onClick={() => setSelectedEvent(event)}
        className={`rounded-[14px] border bg-white px-4 py-4 cursor-pointer transition-shadow ${
          selectedEvent?.id === event.id ? 'ring-1 ring-[var(--color-accent)]' : ''
        }`}
        style={{ borderColor: c.border, boxShadow: `inset 0 3px 0 ${c.accent}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-neutral-500">{event.time}</div>
            <div className="mt-0.5 text-sm font-semibold text-neutral-900">{eventTitle(event)}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg?.badgeClass ?? 'text-gray-400 bg-gray-50 border-gray-200'}`}>
            {cfg?.label ?? event.event_type}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-neutral-600">
          {tl && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Team</div>
              <div className="mt-0.5 font-medium" style={{ color: c.accent }}>{tl}</div>
            </div>
          )}
          {event.workspaces?.name && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Workspace</div>
              <div className="mt-0.5">{event.workspaces.name}</div>
            </div>
          )}
          {det && (
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Detail</div>
              <div className="mt-0.5">{det}</div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {event.workspace_id && (
            <button
              onClick={e => { e.stopPropagation(); window.open(`/workspace/${event.workspace_id}`, '_blank', 'noopener,noreferrer') }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Open Workspace →
            </button>
          )}
          {cp && (
            <button
              onClick={e => { e.stopPropagation(); openDetail(event) }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Check Work
            </button>
          )}
        </div>
      </div>
    )
  }

  // Group messages for detail modal
  const msgGroups: Record<string, {
    agentRole: string; provider: string; model: string
    messages: { role: string; content: string }[]
  }> = {}
  for (const msg of detailMsgs) {
    if (!msgGroups[msg.session_id]) {
      msgGroups[msg.session_id] = {
        agentRole: msg.agent_sessions?.agent_role ?? 'unknown',
        provider:  msg.agent_sessions?.provider   ?? '',
        model:     msg.agent_sessions?.model      ?? '',
        messages:  [],
      }
    }
    msgGroups[msg.session_id].messages.push({ role: msg.role, content: msg.content })
  }
  const groupsArr = Object.values(msgGroups)

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">No events recorded yet.</p>
        <p className="text-gray-700 text-xs mt-1">
          Events appear after Save Version, Lock/Unlock, Review &amp; Forward, or Session Backup.
        </p>
      </div>
    )
  }

  // Guard: wait for client-side focusDate before rendering calendar
  if (!focusDate) return <div className="p-6 text-sm text-gray-600">Loading calendar…</div>

  return (
    <>
      {/* ── Controls: period label + view toggle + prev/next/today ── */}
      <div className="sticky top-0 z-10 bg-[var(--color-app-bg)] pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Event Timeline — {formatPeriodLabel(focusDate, viewMode)}
              <span className="ml-2 text-xs font-normal text-gray-500">
                · {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month / Week / Day toggle */}
            <div className="flex rounded-full border border-gray-200 bg-white p-0.5">
              {(['month', 'week', 'day'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                    viewMode === m ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* Prev / Today / Next */}
            <div className="flex rounded-full border border-gray-200 bg-white p-0.5">
              <button onClick={goToPrev}                        className="h-7 rounded-full px-3 text-xs text-[var(--color-text-primary)] font-medium hover:opacity-75 transition-opacity">Prev</button>
              <button onClick={() => setFocusDate(new Date())} className="h-7 rounded-full px-3 text-xs text-[var(--color-text-primary)] font-medium hover:opacity-75 transition-opacity">Today</button>
              <button onClick={goToNext}                        className="h-7 rounded-full px-3 text-xs text-[var(--color-text-primary)] font-medium hover:opacity-75 transition-opacity">Next</button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All event types</option>
            {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={filterTeamId}
            onChange={e => setFilterTeamId(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All teams</option>
            {uniqueTeams.map(t => (
              <option key={t.id} value={t.id}>
                {teamCodes?.[t.id] ? `${teamCodes[t.id]} · ${t.name}` : t.name}
              </option>
            ))}
          </select>
          {(filterType !== 'all' || filterTeamId !== 'all') && (
            <button
              onClick={() => { setFilterType('all'); setFilterTeamId('all') }}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Month View (ported from demo renderMonthView) ── */}
      {viewMode === 'month' && (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {d}
              </div>
            ))}
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cellDate, i) => {
              const key   = cellDate ? buildDateKey(cellDate) : null
              const evs   = key ? (byDate.get(key) ?? []) : []
              const focus = cellDate ? isSameDay(cellDate, focusDate) : false
              return (
                <div
                  key={`${key ?? 'x'}_${i}`}
                  className={`min-h-[96px] rounded-[10px] border p-1.5 transition-colors ${
                    cellDate ? 'cursor-pointer hover:bg-white/5' : 'border-transparent'
                  }`}
                  style={{
                    background:  cellDate ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderColor: cellDate ? (focus ? 'rgb(156,163,175)' : 'rgb(229,231,235)') : 'transparent',
                  }}
                  onClick={() => { if (cellDate) { setFocusDate(cellDate); setViewMode('day') } }}
                >
                  {cellDate && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-xs font-semibold ${focus ? 'text-gray-900' : 'text-gray-500'}`}>
                          {cellDate.getDate()}
                        </span>
                        {evs.length > 0 && <span className="text-[10px] text-gray-600">{evs.length}</span>}
                      </div>
                      <div className="space-y-0.5">
                        {evs.slice(0, 3).map(e => renderMonthChip(e))}
                        {evs.length > 3 && (
                          <button
                            className="px-1 text-[9px] text-gray-500 hover:text-gray-800 transition-colors"
                            onClick={ev => { ev.stopPropagation(); setFocusDate(cellDate!); setViewMode('day') }}
                          >
                            +{evs.length - 3} more
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Week + Day Views — shared flex layout with side panel ── */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <div className="flex gap-4">
          {/* View content — flex-1 */}
          <div className="flex-1 min-w-0">

            {/* Week View (ported from demo renderWeekView) */}
            {viewMode === 'week' && (
              <div className="overflow-x-auto">
                <div className="grid min-w-[700px] grid-cols-7 gap-2">
                  {weekDates.map(date => {
                    const key   = buildDateKey(date)
                    const evs   = byDate.get(key) ?? []
                    const focus = isSameDay(date, focusDate)
                    return (
                      <div
                        key={key}
                        className="min-h-[300px] rounded-[12px] border p-2"
                        style={{
                          background:  '#ffffff',
                          borderColor: focus ? 'rgb(107,114,128)' : 'rgb(209,213,219)',
                        }}
                      >
                        <button
                          className="w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-white/5 transition-colors"
                          onClick={() => { setFocusDate(date); setViewMode('day') }}
                        >
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">
                            {DAY_NAMES[date.getDay()]}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-gray-800">
                            {MONTH_NAMES[date.getMonth()].slice(0, 3)} {date.getDate()}
                          </div>
                        </button>
                        <div className="mt-2 space-y-1.5">
                          {evs.length > 0
                            ? evs.map(e => renderWeekCard(e))
                            : (
                              <div className="rounded-[8px] border border-dashed border-gray-300 px-2 py-4 text-xs text-gray-400 text-center">
                                —
                              </div>
                            )
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Day View (ported from demo renderDayView) */}
            {viewMode === 'day' && (
              <div className="space-y-3">
              {dayEvents.length > 0
                ? dayEvents.map(e => renderDayCard(e))
                : (
                  <div className="rounded-[14px] border border-dashed border-gray-300 flex items-center justify-center min-h-[160px]">
                    <p className="text-gray-500 text-sm">No events on this day.</p>
                  </div>
                )
              }
              </div>
            )}

          </div>{/* end view content */}

          {/* Side panel — shared between Day and Week */}
          {selectedEvent && (
            <div className="w-80 shrink-0 border-l border-[var(--color-border)] pl-4">
              <div className="sticky top-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      {EVENT_CONFIG[selectedEvent.event_type]?.label ?? selectedEvent.event_type}
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                      {(selectedEvent.metadata?.name as string) ?? selectedEvent.event_type}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-[var(--color-text-secondary)] hover:opacity-75 ml-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-0">
                  <Row label="Created">{new Date(selectedEvent.created_at).toLocaleString()}</Row>
                  <Row label="Team">{selectedEvent.team_name ?? '—'}</Row>
                  <Row label="Workspace">{selectedEvent.workspaces?.name ?? '—'}</Row>
                  {!!selectedEvent.metadata?.name && (
                    <Row label="Checkpoint">{String(selectedEvent.metadata.name)}</Row>
                  )}
                  {!!selectedEvent.metadata?.purpose && (
                    <Row label="Purpose">{String(selectedEvent.metadata.purpose)}</Row>
                  )}
                  {selectedEvent.metadata?.message_count !== undefined && (
                    <Row label="Messages">{String(selectedEvent.metadata.message_count)}</Row>
                  )}
                  {!!selectedEvent.metadata?.to_agent && (
                    <Row label="To Agent">
                      {AGENT_LABEL[String(selectedEvent.metadata.to_agent)] ?? String(selectedEvent.metadata.to_agent)}
                    </Row>
                  )}
                </div>

                {selectedEvent.event_type === 'tool_call_executed' &&
                  Array.isArray(selectedEvent.metadata?.sources) &&
                  (selectedEvent.metadata.sources as { title: string; url: string }[]).length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      Sources
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {(selectedEvent.metadata.sources as { title: string; url: string }[]).map((src, i) => (
                        <li key={i}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--color-accent)] hover:underline break-words"
                          >
                            {src.title || src.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-4">
                  {selectedEvent.workspace_id && (
                    <button
                      onClick={() => window.open(`/workspace/${selectedEvent.workspace_id}`, '_blank', 'noopener,noreferrer')}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90"
                    >
                      Open Workspace →
                    </button>
                  )}
                  {!!selectedEvent.metadata?.checkpoint_id && (
                    <button
                      onClick={() => openDetail(selectedEvent)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-medium hover:opacity-90"
                    >
                      Check Work
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Detail modal (preserved from original AuditTimeline) ── */}
      {detailCpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeDetail() }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate">{detailName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {detailLoading
                    ? 'Loading…'
                    : `${detailMsgs.length} messages · ${groupsArr.length} agent${groupsArr.length !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {detailWsId && (
                  <button
                    onClick={() => window.open(`/workspace/${detailWsId}?checkpoint=${detailCpId}`, '_blank', 'noopener,noreferrer')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Resume Work →
                  </button>
                )}
                <button onClick={closeDetail} className="text-gray-500 hover:text-gray-600 text-sm px-2 transition-colors">
                  Close ✕
                </button>
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
                    <div key={gi} className="bg-gray-50/60 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
                        <p className="text-xs font-semibold text-gray-600">{AGENT_LABEL[g.agentRole] ?? g.agentRole}</p>
                        <p className="text-xs text-gray-500">{g.provider} · {g.model}</p>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                        {g.messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-indigo-900/50 text-indigo-100 ml-3'
                                : 'bg-gray-100 text-gray-800 mr-3'
                            }`}
                          >
                            <span className="font-medium text-gray-400 block mb-0.5">
                              {msg.role === 'user' ? 'User' : 'Agent'}
                            </span>
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
    </>
  )
}
