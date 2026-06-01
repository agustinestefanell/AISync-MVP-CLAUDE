'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { DocCheckpoint, DocHandoffPackage, DocSavedSelection } from '@/lib/db/documentation'

// ── Discriminated union for the unified list ──────────────────────────────
type ListItem =
  | { kind: 'checkpoint';      cp: DocCheckpoint }
  | { kind: 'handoff';         hp: DocHandoffPackage }
  | { kind: 'saved_selection'; ss: DocSavedSelection }

function itemId(item: ListItem) {
  return item.kind === 'checkpoint' ? item.cp.id : item.kind === 'handoff' ? item.hp.id : item.ss.id
}
function itemDate(item: ListItem) {
  return item.kind === 'checkpoint' ? item.cp.created_at : item.kind === 'handoff' ? item.hp.created_at : item.ss.created_at
}

// ── Badge maps ────────────────────────────────────────────────────────────
const PURPOSE_BADGE: Record<string, string> = {
  'Checkpoint':     'text-green-700 bg-green-50 border-green-200',
  'Session Backup': 'text-blue-700 bg-blue-50 border-blue-200',
  'Handoff':        'text-purple-700 bg-purple-50 border-purple-200',
  'Evidence':       'text-orange-700 bg-orange-50 border-orange-200',
}

const STATE_BADGE: Record<string, string> = {
  'active':       'text-emerald-700 bg-emerald-50 border-emerald-200',
  'under_review': 'text-amber-700 bg-amber-50 border-amber-200',
  'locked':       'text-red-700 bg-red-50 border-red-200',
}

const STATUS_BADGE: Record<string, string> = {
  draft:    'text-gray-600 bg-gray-50 border-gray-200',
  sent:     'text-blue-700 bg-blue-50 border-blue-200',
  received: 'text-green-700 bg-green-50 border-green-200',
  archived: 'text-gray-500 bg-gray-50 border-gray-200',
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

const HANDOFF_BADGE          = 'text-purple-700 bg-purple-50 border-purple-200'
const SAVED_SELECTION_BADGE  = 'text-amber-700 bg-amber-50 border-amber-200'

const PURPOSE_LABELS: Record<string, string> = {
  'Checkpoint':            'Checkpoint',
  'Handoff':               'Handoff',
  'Session Backup':        'Session Backup',
  'Evidence':              'Evidence',
  'Documentación':         'Documentation',
  'Retomar después':       'Resume Later',
  'Soporte de auditoría':  'Audit Support',
  'Evidencia':             'Evidence',
}

function getMessagePreview(messages: unknown[]): string {
  const last = messages[messages.length - 1] as Record<string, unknown> | undefined
  if (!last) return ''
  const content = last.content ?? last.text ?? last.message ?? ''
  if (typeof content !== 'string') return ''
  return content.length > 600 ? content.slice(0, 600) + '…' : content
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

// ── Detail panels ─────────────────────────────────────────────────────────
function Row({ label, children, suppressWarn }: { label: string; children: React.ReactNode; suppressWarn?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="ui-meta text-xs text-[var(--color-text-secondary)] w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-[var(--color-text-primary)] leading-relaxed" suppressHydrationWarning={suppressWarn}>{children}</span>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="ui-meta text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className={`text-xs text-[var(--color-text-primary)] truncate max-w-[160px] ${mono ? 'font-mono' : ''}`} title={value}>{value}</span>
    </div>
  )
}

function CheckpointDetailPanel({ cp, userName, onClose, teamCodes }: { cp: DocCheckpoint; userName: string; onClose: () => void; teamCodes?: Record<string, string> }) {
  return (
    <div className="h-full min-h-0 flex flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">{cp.name}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{cp.workspace_name} · {teamLabel(cp.team_id, cp.team_name, teamCodes)}</p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Two-column: main metadata + secondary metadata */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: main metadata */}
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
              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{cp.sensitivity}</span>
            </Row>
            <Row label="Object type">
              <span className="text-xs text-[var(--color-text-secondary)] capitalize">{cp.object_type}</span>
            </Row>
            <Row label="Purpose">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PURPOSE_BADGE[cp.purpose] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                {PURPOSE_LABELS[cp.purpose] ?? cp.purpose}
              </span>
            </Row>
          </div>

          {/* Right: secondary metadata */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Secondary Metadata</p>
            <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 space-y-2.5">
              <MetaRow label="Team"          value={teamLabel(cp.team_id, cp.team_name, teamCodes)} />
              <MetaRow label="Object Type"   value={cp.object_type} />
              <MetaRow label="Project"       value={cp.project_name} />
              <MetaRow label="Workspace"     value={cp.workspace_name} />
              <MetaRow label="Checkpoint ID" value={cp.id} mono />
              {(() => {
                const firstAssistant = cp.checkpoint_messages.find(m => m.role === 'assistant')
                if (!firstAssistant?.agent_role) return null
                return <MetaRow label="AI Agent" value={AGENT_LABEL[firstAssistant.agent_role] ?? firstAssistant.agent_role} />
              })()}
            </div>
          </div>
        </div>

        {/* Full width: conversation */}
        {cp.checkpoint_messages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Conversation</p>
            <MiniChatPreview messages={cp.checkpoint_messages.map(m => ({ ...m, agentRole: m.agent_role }))} />
          </div>
        )}

        {/* Full width: action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.open(`/workspace/${cp.workspace_id}`, '_blank', 'noopener,noreferrer')}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Open Document
          </button>
          <button
            type="button"
            onClick={() => window.open('/audit', '_blank', 'noopener,noreferrer')}
            className="flex-1 text-center ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
          >
            View in Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}

function HandoffDetailPanel({ hp, onClose }: { hp: DocHandoffPackage; onClose: () => void }) {
  return (
    <div className="h-full min-h-0 flex flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-bold uppercase ${HANDOFF_BADGE}`}>
              Handoff Package
            </span>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">{hp.name}</h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{hp.workspace_name}</p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-3">
          <Row label="From → To">
            <span className="font-medium">{AGENT_LABEL[hp.from_agent] ?? hp.from_agent}</span>
            <span className="text-[var(--color-text-muted)]"> → </span>
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
          <Row label="Project">{hp.project_name ?? '—'}</Row>
          <Row label="Team">{hp.team_name ?? '—'}</Row>
          <Row label="Workspace">{hp.workspace_name}</Row>
        </div>

        {hp.context && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Context</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3">
              {hp.context}
            </p>
          </div>
        )}

        {hp.messages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Conversation</p>
            <MiniChatPreview
              messages={hp.messages}
              agentLabel={AGENT_LABEL[hp.from_agent as keyof typeof AGENT_LABEL] ?? 'AI'}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.open(`/workspace/${hp.workspace_id}`, '_blank', 'noopener,noreferrer')}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Open Workspace →
          </button>
          <button
            type="button"
            onClick={() => window.open('/audit', '_blank', 'noopener,noreferrer')}
            className="flex-1 text-center ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
          >
            View in Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}

function SavedSelectionDetailPanel({ ss, onClose, teamCodes }: { ss: DocSavedSelection; onClose: () => void; teamCodes?: Record<string, string> }) {
  return (
    <div className="h-full min-h-0 flex flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-bold uppercase ${SAVED_SELECTION_BADGE}`}>
              Saved Selection
            </span>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">{ss.name}</h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{ss.workspace_name}</p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-3">
          <Row label="Messages">{ss.messages.length} message{ss.messages.length !== 1 ? 's' : ''} saved</Row>
          <Row label="Project">{ss.project_name ?? '—'}</Row>
          <Row label="Team">{ss.team_name ? (ss.team_id ? teamLabel(ss.team_id, ss.team_name, teamCodes) : ss.team_name) : '—'}</Row>
          <Row label="Workspace">{ss.workspace_name}</Row>
          <Row label="Created" suppressWarn>{formatDate(ss.created_at)}</Row>
        </div>
        {ss.messages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Conversation</p>
            <MiniChatPreview
              messages={(ss.messages as { role?: string; content?: string; agent_role?: string }[]).map(m => ({
                role:      m.role      ?? 'user',
                content:   m.content   ?? '',
                agentRole: m.agent_role ?? undefined,
              }))}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.open(`/workspace/${ss.workspace_id}`, '_blank', 'noopener,noreferrer')}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Open Workspace →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Mini chat preview ─────────────────────────────────────────────────────
function MiniChatPreview({
  messages,
  agentLabel = 'AI',
}: {
  messages: { role: string; content: string; agentRole?: string }[]
  agentLabel?: string
}) {
  if (!messages.length) return null
  const displayed = messages.slice(-8)
  return (
    <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3 max-h-64 overflow-y-auto flex flex-col gap-2">
      {displayed.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-0.5`}>
            <span className={`text-[10px] font-semibold px-1 ${
              msg.role === 'user'
                ? 'text-[var(--color-text-muted)]'
                : 'text-[var(--color-accent)]'
            }`}>
              {msg.role === 'user' ? 'You' : (AGENT_LABEL[msg.agentRole ?? ''] ?? agentLabel)}
            </span>
            <div className={`max-w-full rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]'
            }`}>
              {msg.content.slice(0, 300)}{msg.content.length > 300 ? '…' : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-5 py-4">
      <p className="ui-title text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="ui-label text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
interface Props {
  checkpoints:         DocCheckpoint[]
  handoffPackages:     DocHandoffPackage[]
  savedSelections:     DocSavedSelection[]
  userName:            string
  userEmail:           string
  externalSelectedId?: string | null
  onFilterChange?:     (filtered: DocCheckpoint[]) => void
  teamCodes?:          Record<string, string>
}

export default function RepositoryView({
  checkpoints, handoffPackages, savedSelections, userName, externalSelectedId, onFilterChange, teamCodes,
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
  const [searchQuery,   setSearchQuery]   = useState('')
  const [sortOrder,     setSortOrder]     = useState<'newest' | 'oldest' | 'name'>('newest')

  const uniqueProjects = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.project_id, c.project_name])).entries()), [checkpoints])
  const uniqueTeams    = useMemo(() => {
    const m = new Map<string, string>()
    checkpoints.forEach(c => { if (c.team_id) m.set(c.team_id, c.team_name ?? '') })
    handoffPackages.forEach(h => { if (h.team_id) m.set(h.team_id, h.team_name ?? '') })
    savedSelections.forEach(s => { if (s.team_id) m.set(s.team_id, s.team_name ?? '') })
    return Array.from(m.entries()).sort(([idA, nameA], [idB, nameB]) => {
      const codeA = teamCodes?.[idA] ?? nameA
      const codeB = teamCodes?.[idB] ?? nameB
      return codeA.localeCompare(codeB)
    })
  }, [checkpoints, handoffPackages, savedSelections, teamCodes])

  const allItems = useMemo((): ListItem[] => {
    const cps: ListItem[] = checkpoints.map(cp => ({ kind: 'checkpoint', cp }))
    const hps: ListItem[] = handoffPackages.map(hp => ({ kind: 'handoff', hp }))
    const sss: ListItem[] = savedSelections.map(ss => ({ kind: 'saved_selection', ss }))
    return [...cps, ...hps, ...sss].sort((a, b) => itemDate(b).localeCompare(itemDate(a)))
  }, [checkpoints, handoffPackages, savedSelections])

  const filtered = useMemo(() => allItems.filter(item => {
    // Date filter applies to everything
    if (filterDate) {
      if (!itemDate(item).startsWith(filterDate)) return false
    }

    if (item.kind === 'handoff') {
      // Handoffs appear only when type filter is unset or explicitly "Handoff Package"
      return !filterType || filterType === 'Handoff Package'
    }

    if (item.kind === 'saved_selection') {
      return !filterType || filterType === 'Saved Selection'
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

  const displayItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const searched = q
      ? filtered.filter(item => {
          if (item.kind === 'checkpoint') {
            const c = item.cp
            return (
              c.name.toLowerCase().includes(q) ||
              (c.workspace_name ?? '').toLowerCase().includes(q) ||
              (c.team_name ?? '').toLowerCase().includes(q) ||
              (c.responsible ?? '').toLowerCase().includes(q) ||
              (c.project_name ?? '').toLowerCase().includes(q)
            )
          }
          if (item.kind === 'handoff') {
            const h = item.hp
            return (
              h.name.toLowerCase().includes(q) ||
              (h.workspace_name ?? '').toLowerCase().includes(q) ||
              (h.team_name ?? '').toLowerCase().includes(q)
            )
          }
          const s = item.ss
          return (
            s.name.toLowerCase().includes(q) ||
            (s.workspace_name ?? '').toLowerCase().includes(q) ||
            (s.team_name ?? '').toLowerCase().includes(q)
          )
        })
      : filtered

    return [...searched].sort((a, b) => {
      if (sortOrder === 'name') {
        const nameA = a.kind === 'checkpoint' ? a.cp.name : a.kind === 'handoff' ? a.hp.name : a.ss.name
        const nameB = b.kind === 'checkpoint' ? b.cp.name : b.kind === 'handoff' ? b.hp.name : b.ss.name
        return nameA.localeCompare(nameB)
      }
      const dateA = itemDate(a)
      const dateB = itemDate(b)
      return sortOrder === 'oldest'
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA)
    })
  }, [filtered, searchQuery, sortOrder])

  const stats = {
    results:     filtered.length,
    checkpoints: checkpoints.length,
    handoffs:    handoffPackages.length,
    controlled:  checkpoints.filter(c => c.doc_state === 'locked').length,
  }

  function resetFilters() {
    setFilterProject(''); setFilterTeam(''); setFilterType(''); setFilterState(''); setFilterDate('')
    setSearchQuery(''); setSortOrder('newest')
  }
  const hasFilter = filterProject || filterTeam || filterType || filterState || filterDate || searchQuery

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Stats */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Results"        value={stats.results} />
        <StatCard label="Checkpoints"    value={stats.checkpoints} />
        <StatCard label="Handoff Pkgs"   value={stats.handoffs} />
        <StatCard label="Controlled"     value={stats.controlled} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left: filters + list */}
        <div className={`flex flex-col min-h-0 ${selectedItem ? 'w-1/2' : 'flex-1'} min-w-0 border-r border-[var(--color-border-subtle)]`}>
          {/* Filters */}
          <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
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
              <option value="Saved Selection">Saved Selection</option>
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="">All states</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
            <input
              type="text"
              placeholder="Search by title, actor, workspace, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[260px]"
            />
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-600 px-2">
                Reset
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {displayItems.length === 0 ? (
              allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="text-4xl">📄</span>
                  <p className="text-[var(--color-text-primary)] font-medium">No documents yet</p>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
                    Save a checkpoint, handoff, or selection from the Workspace to see it here.
                  </p>
                </div>
              ) : hasFilter ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="text-4xl">🔍</span>
                  <p className="text-[var(--color-text-primary)] font-medium">No results found</p>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
                    Try different filters or search terms.
                  </p>
                  <button
                    onClick={() => {
                      setFilterProject('')
                      setFilterTeam('')
                      setFilterType('')
                      setFilterState('')
                      setFilterDate('')
                      setSearchQuery('')
                    }}
                    className="mt-2 text-sm text-[var(--color-accent)] underline hover:opacity-75"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-sm text-[var(--color-text-secondary)]">No results.</p>
                </div>
              )
            ) : (
              <div className="p-4 grid gap-3 content-start">
                {displayItems.map(item => {
                  const id       = itemId(item)
                  const isActive = selectedId === id
                  return (
                    <article
                      key={id}
                      onClick={() => setSelectedId(isActive ? null : id)}
                      className={`rounded-[14px] border bg-[var(--color-surface)] overflow-hidden cursor-pointer transition-colors hover:bg-[var(--color-surface-subtle)] ${
                        isActive
                          ? 'border-indigo-500 ring-1 ring-indigo-500'
                          : 'border-[var(--color-border-subtle)]'
                      }`}
                    >
                      {item.kind === 'checkpoint' ? (
                        <div className="px-4 py-3">
                          {/* Top row: icon + title + badges */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2.75h5.25L15.5 7v10.25a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
                                <path d="M11 2.75V7h4.5" />
                                <path d="M7.5 10.25h5" />
                                <path d="M7.5 13h5" />
                              </svg>
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{item.cp.name}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${STATE_BADGE[item.cp.doc_state] ?? STATE_BADGE.active}`}>
                                {item.cp.doc_state.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full border border-neutral-200 bg-white font-semibold uppercase tracking-[0.12em] text-neutral-600">
                                {item.cp.version_label}
                              </span>
                            </div>
                          </div>
                          {/* Pills: purpose + team + workspace */}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${PURPOSE_BADGE[item.cp.purpose] ?? 'text-gray-600 border-gray-200 bg-gray-50'}`}>
                              {PURPOSE_LABELS[item.cp.purpose] ?? item.cp.purpose}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-sky-700">
                              {teamLabel(item.cp.team_id, item.cp.team_name, teamCodes)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)]">
                              {item.cp.workspace_name}
                            </span>
                          </div>
                          {/* Preview */}
                          {item.cp.content_preview && (
                            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                              {item.cp.content_preview}
                            </p>
                          )}
                          {/* Bottom strip: metadata + buttons */}
                          <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-2">
                            <div className="text-[10px] leading-[1.5] text-[var(--color-text-muted)] flex flex-wrap gap-x-3 gap-y-0.5">
                              <span><span className="font-semibold text-[var(--color-text-secondary)]">Owner:</span> {item.cp.responsible ?? userName}</span>
                              <span><span className="font-semibold text-[var(--color-text-secondary)]">Sensitivity:</span> {item.cp.sensitivity}</span>
                              <span suppressHydrationWarning><span className="font-semibold text-[var(--color-text-secondary)]">Created:</span> {formatDate(item.cp.created_at)}</span>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedId(id) }}
                                className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                              >
                                View Details
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); window.open('/audit', '_blank', 'noopener,noreferrer') }}
                                className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                              >
                                View in Audit Log →
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : item.kind === 'saved_selection' ? (
                        <div className="px-4 py-3">
                          {/* Top row: SAVED SELECTION badge + title */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 13.5v-7Z" />
                                <path d="M7 9.5h6M7 12h4" />
                              </svg>
                              <div className="min-w-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase mr-1.5 ${SAVED_SELECTION_BADGE}`}>SAVED SELECTION</span>
                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.ss.name}</span>
                              </div>
                            </div>
                            <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-[0.08em] text-amber-700 bg-amber-50 border-amber-200">
                              {item.ss.messages.length} msgs
                            </span>
                          </div>
                          {/* Preview */}
                          {getMessagePreview(item.ss.messages) && (
                            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                              {getMessagePreview(item.ss.messages)}
                            </p>
                          )}
                          {/* Pills: team + workspace */}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {item.ss.team_name && (
                              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-sky-700">
                                {item.ss.team_id ? teamLabel(item.ss.team_id, item.ss.team_name, teamCodes) : item.ss.team_name}
                              </span>
                            )}
                            <span className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)]">
                              {item.ss.workspace_name}
                            </span>
                          </div>
                          {/* Bottom strip */}
                          <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-2">
                            <div className="text-[10px] leading-[1.5] text-[var(--color-text-muted)]">
                              <span suppressHydrationWarning><span className="font-semibold text-[var(--color-text-secondary)]">Created:</span> {formatDate(item.ss.created_at)}</span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedId(id) }}
                              className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3">
                          {/* Top row: icon + HANDOFF badge + title + status badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2.75h5.25L15.5 7v10.25a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
                                <path d="M11 2.75V7h4.5" />
                                <path d="M7.5 10.25h5" />
                                <path d="M7.5 13h5" />
                              </svg>
                              <div className="min-w-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase mr-1.5 ${HANDOFF_BADGE}`}>HANDOFF PACKAGE</span>
                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.hp.name}</span>
                              </div>
                            </div>
                            <span className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${STATUS_BADGE[item.hp.status] ?? STATUS_BADGE.draft}`}>
                              {item.hp.status}
                            </span>
                          </div>
                          {/* Pills: agents + workspace */}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)]">
                              {AGENT_LABEL[item.hp.from_agent] ?? item.hp.from_agent} → {AGENT_LABEL[item.hp.to_agent] ?? item.hp.to_agent}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)]">
                              {item.hp.workspace_name}
                            </span>
                          </div>
                          {/* Preview */}
                          {item.hp.content_preview && (
                            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                              {item.hp.content_preview}
                            </p>
                          )}
                          {/* Bottom strip: metadata + buttons */}
                          <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-2">
                            <div className="text-[10px] leading-[1.5] text-[var(--color-text-muted)] flex flex-wrap gap-x-3 gap-y-0.5">
                              <span><span className="font-semibold text-[var(--color-text-secondary)]">Messages:</span> {item.hp.message_count}</span>
                              <span suppressHydrationWarning><span className="font-semibold text-[var(--color-text-secondary)]">Created:</span> {formatDate(item.hp.created_at)}</span>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedId(id) }}
                                className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
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
            {selectedItem.kind === 'saved_selection' && (
              <SavedSelectionDetailPanel ss={selectedItem.ss} onClose={() => setSelectedId(null)} teamCodes={teamCodes} />
            )}
          </div>
        )}

        {!selectedItem && (
          <div className="hidden md:flex flex-1 items-center justify-center text-[var(--color-text-muted)] text-sm">
            Select a document to view details
          </div>
        )}
      </div>
    </div>
  )
}
