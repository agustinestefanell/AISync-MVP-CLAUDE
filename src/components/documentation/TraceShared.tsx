'use client'

// Piezas compartidas por las pestañas "Web Searches" y "Attached Files" de
// Documentation Mode (OE Trazabilidad, Parte 2 — 2026-09-29). Mismo lenguaje
// visual que RepositoryView.tsx (StatCard, Row, panel de detalle).

import type { ReactNode } from 'react'
import type { ProjectWithTeams } from '@/lib/db/types'
import { AGENT_LABEL } from '@/lib/documentation/anchors'

export const FILTER_CLASS =
  'bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500'

// Fecha y hora exactas (con segundos): "Open in Workspace" abre la
// conversación al final, así que esta marca es la que permite ubicar el
// evento a mano dentro del chat.
export function formatExact(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function agentLabel(role: string | null): string {
  return role ? AGENT_LABEL[role] ?? role : '—'
}

export function teamLabel(id: string | null, name: string | null, codes?: Record<string, string>): string {
  if (!name) return '—'
  const code = id ? codes?.[id] : undefined
  return code ? `${code} · ${name}` : name
}

export function locationLine(
  item: { project_name: string | null; team_id: string | null; team_name: string | null; workspace_name: string },
  codes?: Record<string, string>,
): string {
  return `${item.project_name ?? '—'} / ${teamLabel(item.team_id, item.team_name, codes)} / ${item.workspace_name}`
}

// Teams disponibles para el filtro — acotados al Project elegido (mismo
// patrón que Repository View / Audit View).
export function teamOptions(
  items: { team_id: string | null; team_name: string | null; project_id: string | null }[],
  filterProject: string,
  codes?: Record<string, string>,
): [string, string][] {
  const m = new Map<string, string>()
  for (const i of items) {
    if (i.team_id && (!filterProject || i.project_id === filterProject)) m.set(i.team_id, i.team_name ?? '')
  }
  return Array.from(m.entries()).sort(([a, an], [b, bn]) => (codes?.[a] ?? an).localeCompare(codes?.[b] ?? bn))
}

export function projectOptions(projects: ProjectWithTeams[]): [string, string][] {
  return projects.map(p => [p.id, p.name] as [string, string])
}

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-5 py-4">
      <p className="ui-title text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="ui-label text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium tracking-wide uppercase">{label}</p>
    </div>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="ui-meta text-xs text-[var(--color-text-secondary)] w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-[var(--color-text-primary)] leading-relaxed min-w-0 break-words" suppressHydrationWarning>{children}</span>
    </div>
  )
}

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">{children}</p>
}

// Fragmento de la respuesta del agente asociada — lo que le da contexto al
// evento meses después. `empty` explica por qué no hay respuesta (nunca se
// oculta: una búsqueda sin respuesta es información en sí misma).
export function ResponseSnippet({
  snippet, at, note, empty,
}: { snippet: string | null; at: string | null; note?: string; empty: string }) {
  return (
    <div>
      <SectionTitle>Agent response</SectionTitle>
      {snippet ? (
        <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3">
          <p className="text-xs text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">{snippet}</p>
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]" suppressHydrationWarning>
            {at ? `Response saved ${formatExact(at)}` : null}{note ? `${at ? ' · ' : ''}${note}` : null}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{empty}</p>
      )}
    </div>
  )
}

// Abre el workspace en otra pestaña, al final de la conversación (como el
// resto de Documentation Mode). El salto al mensaje exacto se descartó para
// esta OE (no tocar WorkspaceShell/AgentPanel, decisión de Agus) — por eso se
// muestra la fecha y hora exactas para ubicarlo a mano.
export function OpenInWorkspace({ workspaceId, at, agentRole }: { workspaceId: string | null; at: string; agentRole: string | null }) {
  if (!workspaceId) {
    return <p className="text-xs text-[var(--color-text-muted)]">The original workspace is no longer available.</p>
  }
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => window.open(`/workspace/${workspaceId}`, '_blank', 'noopener,noreferrer')}
        className="w-full text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors"
      >
        Open in Workspace →
      </button>
      <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed" suppressHydrationWarning>
        Opens the conversation at its latest message. This happened in the {agentLabel(agentRole)} chat on {formatExact(at)} — scroll up to that time to find it.
      </p>
    </div>
  )
}

export function LoadState({ loading, error, empty, emptyText }: { loading: boolean; error: string | null; empty: boolean; emptyText: string }) {
  if (loading) return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">Loading…</div>
  if (error)   return <div className="py-16 text-center text-sm text-red-700">{error}</div>
  if (empty)   return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">{emptyText}</div>
  return null
}

// ── "Information used" de Audit View — búsquedas y adjuntos del momento ─────
// Formato de /api/documentation/audit-detail (webSearches / attachments).

export interface AuditWebSearch {
  id:           string
  query:        string
  created_at:   string
  link_state:   'linked' | 'interrupted' | 'failed' | 'legacy'
  cited_count:  number | null
  source_count: number
}

export interface AuditAttachment {
  id:              string
  filename:        string
  attachment_type: 'image' | 'document'
  size_bytes:      number | null
  created_at:      string
  is_legacy:       boolean
}

function auditSearchStatus(s: AuditWebSearch): string {
  if (s.link_state === 'failed')      return 'Search failed'
  if (s.link_state === 'interrupted') return 'Response not saved (interrupted)'
  if (s.link_state === 'legacy')      return `${s.source_count} sources · before linking`
  if (s.cited_count === null)         return `${s.source_count} sources`
  return s.cited_count > 0 ? `Cited ${s.cited_count} of ${s.source_count}` : 'No sources cited'
}

const TRACE_ROW_BADGE = 'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold'

export function TraceInformationRows({ webSearches, attachments }: { webSearches: AuditWebSearch[]; attachments: AuditAttachment[] }) {
  return (
    <>
      {webSearches.map(s => (
        <div key={s.id} className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--color-text-primary)] truncate" title={s.query}>&ldquo;{s.query || '—'}&rdquo;</span>
          <span className={`${TRACE_ROW_BADGE} ${s.link_state === 'interrupted' || s.link_state === 'failed' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-sky-700 bg-sky-50 border-sky-200'}`}>
            Web Search · {auditSearchStatus(s)}
          </span>
        </div>
      ))}
      {attachments.map(a => (
        <div key={a.id} className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--color-text-primary)] truncate" title={a.filename}>{a.filename}</span>
          <span className={`${TRACE_ROW_BADGE} text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200`}>
            Attachment · {formatBytes(a.size_bytes)}{a.is_legacy ? ' · legacy' : ''}
          </span>
        </div>
      ))}
    </>
  )
}
