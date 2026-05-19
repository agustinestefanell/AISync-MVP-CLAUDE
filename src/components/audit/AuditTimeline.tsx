'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { AuditEventRow } from '@/lib/db/audit'
import { getProjectColorTokens, teamCodeToPaletteIndex } from '@/lib/teams/getProjectColor'

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
  unlock:         { label: 'Workspace unlocked',  badgeClass: 'text-gray-400 bg-gray-800 border-gray-700' },
  review_forward: { label: 'Review & Forward',    badgeClass: 'text-purple-400 bg-purple-950 border-purple-900' },
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
  if (e.event_type === 'review_forward') return `Forwarded to ${(m.to_agent as string) ?? 'agent'}`
  return e.event_type
}

function eventDetail(e: AuditEventRow): string | null {
  const m = e.metadata ?? {}
  if (e.event_type === 'save_version')   return [m.purpose, `${m.message_count ?? 0} msgs`].filter(Boolean).join(' · ')
  if (e.event_type === 'session_backup') return `${m.total_messages ?? 0} messages exported`
  if (e.event_type === 'review_forward') return `${m.message_count ?? ''} message(s)`
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditTimeline({ events, externalDetailCpId, onFilterChange, teamCodes }: {
  events:               AuditEventRow[]
  externalDetailCpId?:  string | null
  onFilterChange?:      (filtered: AuditEventRow[]) => void
  teamCodes?:           Record<string, string>
}) {
  const router = useRouter()

  // Calendar state
  const [viewMode,  setViewMode]  = useState<ViewMode>('month')
  const [focusDate, setFocusDate] = useState<Date>(() =>
    events.length > 0 ? new Date(events[0].created_at) : new Date()
  )

  // Filter state
  const [filterType,   setFilterType]   = useState('all')
  const [filterTeamId, setFilterTeamId] = useState('all')

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
    time: new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  })), [events])

  // Unique teams for filter dropdown
  const uniqueTeams = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of normalized) if (e.team_id && e.team_name) seen.set(e.team_id, e.team_name)
    const result: { id: string; name: string }[] = []
    seen.forEach((name, id) => result.push({ id, name }))
    return result
  }, [normalized])

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

  // Derived calendar data
  const monthCells = useMemo(() => getMonthCells(focusDate), [focusDate])
  const weekDates  = useMemo(() => {
    const start = getStartOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [focusDate])
  const dayEvents = byDate.get(buildDateKey(focusDate)) ?? []

  // Navigation (ported from demo PageC.tsx goToPrevious / goToNext / resetFocus)
  const goToPrev = () => {
    if (viewMode === 'month') setFocusDate(d => addMonths(d, -1))
    else if (viewMode === 'week') setFocusDate(d => addDays(d, -7))
    else setFocusDate(d => addDays(d, -1))
  }
  const goToNext = () => {
    if (viewMode === 'month') setFocusDate(d => addMonths(d, 1))
    else if (viewMode === 'week') setFocusDate(d => addDays(d, 7))
    else setFocusDate(d => addDays(d, 1))
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
  function retomar(e: AuditEventRow) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId || !e.workspace_id) return
    router.push(`/workspace/${e.workspace_id}?checkpoint=${cpId}`)
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
        style={{ borderColor: c.border, backgroundColor: c.bg, color: c.accent }}
        onClick={ev => { ev.stopPropagation(); openDetail(event) }}
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
        onClick={ev => { ev.stopPropagation(); openDetail(event) }}
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
        className="rounded-[14px] border bg-white px-4 py-4"
        style={{ borderColor: c.border, boxShadow: `inset 0 3px 0 ${c.accent}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-neutral-500">{event.time}</div>
            <div className="mt-0.5 text-sm font-semibold text-neutral-900">{eventTitle(event)}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg?.badgeClass ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>
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

        {cp && (
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => openDetail(event)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View Detail →
            </button>
            <button
              onClick={() => retomar(event)}
              className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              Resume Work →
            </button>
          </div>
        )}
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

  return (
    <>
      {/* ── Controls: period label + view toggle + prev/next/today ── */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">{formatPeriodLabel(focusDate, viewMode)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month / Week / Day toggle */}
            <div className="flex rounded-full border border-gray-700 bg-gray-900 p-0.5">
              {(['month', 'week', 'day'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                    viewMode === m ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* Prev / Today / Next */}
            <div className="flex rounded-full border border-gray-700 bg-gray-900 p-0.5">
              <button onClick={goToPrev}                        className="h-7 rounded-full px-3 text-xs text-gray-400 hover:text-gray-200 transition-colors">Prev</button>
              <button onClick={() => setFocusDate(new Date())} className="h-7 rounded-full px-3 text-xs text-gray-400 hover:text-gray-200 transition-colors">Today</button>
              <button onClick={goToNext}                        className="h-7 rounded-full px-3 text-xs text-gray-400 hover:text-gray-200 transition-colors">Next</button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All event types</option>
            {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={filterTeamId}
            onChange={e => setFilterTeamId(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
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
              className="text-xs text-gray-500 hover:text-gray-300 px-2 transition-colors"
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
                    borderColor: cellDate ? (focus ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)') : 'transparent',
                  }}
                  onClick={() => { if (cellDate) { setFocusDate(cellDate); setViewMode('day') } }}
                >
                  {cellDate && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-xs font-semibold ${focus ? 'text-white' : 'text-gray-500'}`}>
                          {cellDate.getDate()}
                        </span>
                        {evs.length > 0 && <span className="text-[10px] text-gray-600">{evs.length}</span>}
                      </div>
                      <div className="space-y-0.5">
                        {evs.slice(0, 3).map(e => renderMonthChip(e))}
                        {evs.length > 3 && (
                          <button
                            className="px-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
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

      {/* ── Week View (ported from demo renderWeekView) ── */}
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
                    background:  'rgba(255,255,255,0.02)',
                    borderColor: focus ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <button
                    className="w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-white/5 transition-colors"
                    onClick={() => { setFocusDate(date); setViewMode('day') }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">
                      {DAY_NAMES[date.getDay()]}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-gray-200">
                      {MONTH_NAMES[date.getMonth()].slice(0, 3)} {date.getDate()}
                    </div>
                  </button>
                  <div className="mt-2 space-y-1.5">
                    {evs.length > 0
                      ? evs.map(e => renderWeekCard(e))
                      : (
                        <div className="rounded-[8px] border border-dashed border-gray-800 px-2 py-4 text-xs text-gray-700 text-center">
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

      {/* ── Day View (ported from demo renderDayView) ── */}
      {viewMode === 'day' && (
        <div className="space-y-3">
          {dayEvents.length > 0
            ? dayEvents.map(e => renderDayCard(e))
            : (
              <div className="rounded-[14px] border border-dashed border-gray-800 flex items-center justify-center min-h-[160px]">
                <p className="text-gray-600 text-sm">No events on this day.</p>
              </div>
            )
          }
        </div>
      )}

      {/* ── Detail modal (preserved from original AuditTimeline) ── */}
      {detailCpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeDetail() }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">
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
                    onClick={() => { router.push(`/workspace/${detailWsId}?checkpoint=${detailCpId}`); closeDetail() }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Resume Work →
                  </button>
                )}
                <button onClick={closeDetail} className="text-gray-500 hover:text-gray-300 text-sm px-2 transition-colors">
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
                    <div key={gi} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 shrink-0">
                        <p className="text-xs font-semibold text-gray-300">{AGENT_LABEL[g.agentRole] ?? g.agentRole}</p>
                        <p className="text-xs text-gray-500">{g.provider} · {g.model}</p>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                        {g.messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-indigo-900/50 text-indigo-100 ml-3'
                                : 'bg-gray-700 text-gray-200 mr-3'
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
