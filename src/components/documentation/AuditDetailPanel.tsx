'use client'

import { useEffect, useState } from 'react'
import type { DocAuditEvent } from '@/lib/db/documentation'
import type { AnchorMeta } from './AuditView'

// ── Panel derecho de Audit View (Fase 2, Paso 3) — reconstrucción de
// auditoría de una ancla seleccionada. Model/Agent y Related object quedan
// explícitamente ocultos (decisión de producto, ver handoff-2026-07-b.md
// 2026-08-19 Fase 2 Paso 0) — no hay placeholders para ellos acá.

const AGENT_LABEL: Record<string, string> = {
  manager:    'Manager',
  worker1:    'Worker 1',
  worker2:    'Worker 2',
  human_chat: 'Human Chat',
}

const CHAIN_BADGE: Record<'used' | 'not_used', { label: string; className: string }> = {
  used:     { label: 'Used downstream', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  not_used: { label: 'Not used yet',    className: 'text-gray-600 bg-gray-50 border-gray-200' },
}

const SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  team:    { label: 'Team',    className: 'text-blue-700 bg-blue-50 border-blue-200' },
  session: { label: 'Session', className: 'text-teal-700 bg-teal-50 border-teal-200' },
  project: { label: 'Project', className: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
}

// Object/Result legibles por tipo de evento real — mismos 10 tipos
// confirmados que ya alimentan Prior steps (ver AuditView.tsx PRIOR_STEP_TYPES).
function describeEvent(e: DocAuditEvent): { label: string; object: string; result: string; agentRole: string } {
  const m = e.metadata ?? {}
  switch (e.event_type) {
    case 'save_version':
      return { label: 'Checkpoint saved', object: (m.name as string) ?? 'Checkpoint', result: `${(m.message_count as number) ?? '—'} messages saved`, agentRole: '—' }
    case 'resume_work':
      return { label: 'Checkpoint resumed', object: (m.name as string) ?? 'Checkpoint', result: 'Resumed', agentRole: '—' }
    case 'handoff_received':
      return { label: 'Handoff received', object: 'Handoff Package', result: 'Marked as received', agentRole: '—' }
    case 'review_forward': {
      const isToHuman = (m.target_type === 'human_chat') || (m.to === 'human_chat')
      const from = m.from === 'human_chat' ? 'Human Chat' : (AGENT_LABEL[(m.from as string) ?? ''] ?? (m.from as string) ?? '—')
      const to   = isToHuman ? ((m.target_email as string) ?? 'Connected human') : (AGENT_LABEL[(m.to as string) ?? ''] ?? (m.to as string) ?? '—')
      return { label: 'Review & Forward', object: `${from} → ${to}`, result: 'Forwarded', agentRole: from }
    }
    case 'save_selection':
      return { label: 'Selection saved', object: (m.name as string) ?? 'Selection', result: `${(m.message_count as number) ?? '—'} messages`, agentRole: '—' }
    case 'context_file_uploaded':
      return { label: 'Context file uploaded', object: (m.file_name as string) ?? 'File', result: 'Uploaded', agentRole: '—' }
    case 'context_file_injected': {
      const ids = (m.context_source_ids as string[] | undefined) ?? []
      return { label: 'Context file injected', object: `${ids.length} file(s)`, result: 'Injected into chat', agentRole: '—' }
    }
    case 'prompt_assigned':
      return { label: 'Prompt assigned', object: (m.target_type as string) === 'team' ? 'Team prompt' : 'Worker prompt', result: 'Assigned', agentRole: '—' }
    case 'prompt_unassigned':
      return { label: 'Prompt unassigned', object: (m.target_type as string) === 'team' ? 'Team prompt' : 'Worker prompt', result: 'Unassigned', agentRole: '—' }
    case 'agent_model_changed':
      return { label: 'Agent model changed', object: (m.new_model as string) ?? '—', result: `${(m.old_model as string) ?? '—'} → ${(m.new_model as string) ?? '—'}`, agentRole: '—' }
    default:
      return { label: e.event_type, object: '—', result: '—', agentRole: '—' }
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function teamLabel(id: string | null, name: string | null, codes?: Record<string, string>): string {
  if (!name) return '—'
  const code = id ? codes?.[id] : undefined
  return code ? `${code} · ${name}` : name
}

interface AuditMessage {
  id:         string
  role:       string
  content:    string
  session_id: string
  agent_role: string | null
  created_at: string
}
interface AuditContextFile { id: string; title: string; scope: string }
interface AuditPrompt      { id: string; title: string; scope: string }

// Fila combinada del timeline: eventos reales de audit_log + mensajes clave
// de chat en la misma ventana, cruzados por timestamp.
type TimelineRow =
  | { kind: 'event';   time: string; label: string; detail: string; agentRole: string }
  | { kind: 'message'; time: string; label: string; detail: string; agentRole: string }

interface Props {
  anchorKindLabel: string
  title:           string
  flow:            string | null
  meta:            AnchorMeta
  priorSteps:      number
  chainState:      'used' | 'not_used'
  auditStart:      string
  timelineEvents:  DocAuditEvent[]
  origin:          { label: string; date?: string } | null
  downstreamItems: { label: string; date: string }[]
  sessionIds:      string[]
  teamCodes?:      Record<string, string>
  // Solo presente cuando la ancla seleccionada es Review & Forward — contenido
  // real del mensaje reenviado (Pieza 3, 2026-08-21) + emisor/receptor legibles.
  reviewForward?: {
    from: string
    to: string
    executedBy: string | null
    isHumanTarget: boolean
    content: string | null
  }
  onClose:         () => void
}

export default function AuditDetailPanel({
  anchorKindLabel, title, flow, meta, priorSteps, chainState,
  auditStart, timelineEvents, origin, downstreamItems, sessionIds, teamCodes, reviewForward, onClose,
}: Props) {
  const [messages,     setMessages]     = useState<AuditMessage[]>([])
  const [contextFiles, setContextFiles] = useState<AuditContextFile[]>([])
  const [prompts,      setPrompts]      = useState<AuditPrompt[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showTable,    setShowTable]    = useState(false)

  const sessionIdsKey = sessionIds.join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setMessages([]); setContextFiles([]); setPrompts([])
      try {
        const params = new URLSearchParams({
          workspaceId: meta.wsId,
          start:       auditStart,
          end:         meta.date,
        })
        if (meta.teamId) params.set('teamId', meta.teamId)
        if (sessionIdsKey) params.set('sessionIds', sessionIdsKey)

        const res = await fetch(`/api/documentation/audit-detail?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json() as { messages: AuditMessage[]; contextFiles: AuditContextFile[]; prompts: AuditPrompt[] }
        if (cancelled) return
        setMessages(data.messages ?? [])
        setContextFiles(data.contextFiles ?? [])
        setPrompts(data.prompts ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [meta.wsId, meta.teamId, meta.date, auditStart, sessionIdsKey])

  const chain = CHAIN_BADGE[chainState]

  // Timeline unificado: eventos reales de audit_log + mensajes de chat en la
  // misma ventana, ordenados cronológicamente.
  const timelineRows: TimelineRow[] = [
    ...timelineEvents.map((e): TimelineRow => {
      const d = describeEvent(e)
      return { kind: 'event', time: e.created_at, label: d.label, detail: `${d.object} — ${d.result}`, agentRole: d.agentRole }
    }),
    ...messages.map((m): TimelineRow => ({
      kind:      'message',
      time:      m.created_at,
      label:     m.role === 'user' ? 'Message sent' : 'Agent response',
      detail:    m.content.length > 140 ? `${m.content.slice(0, 140)}…` : m.content,
      agentRole: m.agent_role ? (AGENT_LABEL[m.agent_role] ?? m.agent_role) : '—',
    })),
  ].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="h-full min-h-0 flex flex-col flex-1 min-w-0 bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {anchorKindLabel}
          </span>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight truncate">{title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Audit reconstruction · {teamLabel(meta.teamId, meta.teamName, teamCodes)} / {meta.wsName}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* 3a — Header cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Audit target</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">{anchorKindLabel}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Produced from</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">{priorSteps} prior step{priorSteps !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Information used</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
              {loading ? '…' : `${contextFiles.length + prompts.length} source${contextFiles.length + prompts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Chain status</p>
            <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${chain.className}`}>
              {chain.label}
            </span>
          </div>
        </div>

        {flow && (
          <p className="text-xs text-[var(--color-text-secondary)]">{flow}</p>
        )}

        {reviewForward && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Forwarded content
            </p>
            {reviewForward.executedBy && (
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">Executed by: {reviewForward.executedBy}</p>
            )}
            {reviewForward.isHumanTarget ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Content not available for this forward type.
              </p>
            ) : reviewForward.content ? (
              <div className="text-xs leading-relaxed whitespace-pre-wrap rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5 max-h-56 overflow-y-auto">
                {reviewForward.content}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic">Content not available.</p>
            )}
          </div>
        )}

        {/* 3b — Timeline */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            How this was produced
          </p>
          {loading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Loading timeline…</p>
          ) : timelineRows.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No prior steps found in this workspace before this anchor.</p>
          ) : (
            <div className="relative pl-4 border-l-2 border-[var(--color-border-default)] space-y-3">
              {timelineRows.map((row, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                  <p className="text-[11px] text-[var(--color-text-muted)]" suppressHydrationWarning>{formatTime(row.time)}</p>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">{row.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{row.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3c — Information used */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Information used
          </p>
          {loading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
          ) : (contextFiles.length === 0 && prompts.length === 0) ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              No active Context Files or Prompts found for this Team/Session right now.
              Reflects current state, not necessarily what was active when this anchor was produced.
            </p>
          ) : (
            <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 space-y-2.5">
              {contextFiles.map(cf => (
                <div key={cf.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--color-text-primary)] truncate">{cf.title}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SCOPE_BADGE[cf.scope]?.className ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    {SCOPE_BADGE[cf.scope]?.label ?? cf.scope} · Context File
                  </span>
                </div>
              ))}
              {prompts.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--color-text-primary)] truncate">{p.title}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SCOPE_BADGE[p.scope]?.className ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    {SCOPE_BADGE[p.scope]?.label ?? p.scope} · Prompt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3d — Chain of Custody */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Chain of Custody
          </p>
          {!origin && downstreamItems.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No linked objects — nothing upstream or downstream of this anchor yet.</p>
          ) : (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {origin && (
                  <>
                    <span className="rounded-lg border border-[var(--color-border-default)] bg-white px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                      {origin.label}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs">→</span>
                  </>
                )}
                <span className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-white">
                  {title}
                </span>
                {downstreamItems.length > 0 && (
                  <span className="text-[var(--color-text-muted)] text-xs">→</span>
                )}
                {downstreamItems.map((d, i) => (
                  <span key={i} className="rounded-lg border border-[var(--color-border-default)] bg-white px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3e — Event table (colapsable, cerrada por default) */}
        <div>
          <button
            onClick={() => setShowTable(s => !s)}
            className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider hover:opacity-75"
          >
            {showTable ? '▾' : '▸'} Event table ({timelineRows.length})
          </button>
          {showTable && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[var(--color-surface-subtle)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">Time</th>
                    <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">Event</th>
                    <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">Agent / Role</th>
                    <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--color-border-subtle)]">
                      <td className="px-3 py-2 text-[var(--color-text-muted)]" suppressHydrationWarning>{formatDateTime(row.time)}</td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">{row.label}</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{row.agentRole}</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
