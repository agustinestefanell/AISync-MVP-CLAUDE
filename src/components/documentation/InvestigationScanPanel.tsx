'use client'

import { useEffect, useState } from 'react'
import type { AnchorMeta } from '@/lib/documentation/anchors'

// ── Panel derecho de Investigate View (Fase A, 2026-08-20) — Session Scan /
// Deep Search sobre un ancla seleccionada. Endpoint dedicado
// /api/investigation-scan, sin relación con el SM lateral. Ver handoff
// 2026-07-b.md 2026-08-20.

const VERDICT_CARDS: { key: Verdict; label: string; hint: string; className: string; activeClassName: string }[] = [
  { key: 'yes',          label: 'Yes',          hint: 'Requirement met',       className: 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]', activeClassName: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { key: 'partial',      label: 'Partial',      hint: 'Partially addressed',   className: 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]', activeClassName: 'border-amber-400 bg-amber-50 text-amber-800' },
  { key: 'no',           label: 'No',           hint: 'Not addressed',         className: 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]', activeClassName: 'border-rose-400 bg-rose-50 text-rose-800' },
  { key: 'inconclusive', label: 'Inconclusive', hint: 'Not enough evidence',   className: 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]', activeClassName: 'border-gray-400 bg-gray-100 text-gray-800' },
]

type Verdict = 'yes' | 'partial' | 'no' | 'inconclusive'
type ScanMode = 'session_scan' | 'deep_search'

interface ScopeSource { sessionId: string; agentRole: string; label: string }
interface Evidence     { source: string; excerpt: string; timestamp?: string }

interface ScanResult {
  verdict:           Verdict
  justification:      string
  evidence:            Evidence[]
  sourcesScanned:      ScopeSource[]
  sourcesNotScanned:   ScopeSource[]
  ranAs:               ScanMode
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-[var(--color-border-default)] text-[10px] leading-none flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)]"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span className="absolute z-20 top-5 left-0 w-56 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)] shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

interface Props {
  anchorKindLabel: string
  title:           string
  meta:            AnchorMeta
  workspaceId:     string
  anchorKind:      'checkpoint' | 'handoff' | 'saved_selection' | 'loaded_context' | 'review_forward'
  anchorId:        string
  originAgentRole?: string
  flavor?:          'context_files' | 'chat'
  originType?:      'checkpoint' | 'handoff_package' | 'saved_selection'
  originId?:        string
  investigationFocus: string
  teamCodes?:      Record<string, string>
  onClose:         () => void
}

function teamLabel(id: string | null, name: string | null, codes?: Record<string, string>): string {
  if (!name) return '—'
  const code = id ? codes?.[id] : undefined
  return code ? `${code} · ${name}` : name
}

export default function InvestigationScanPanel({
  anchorKindLabel, title, meta, workspaceId, anchorKind, anchorId,
  originAgentRole, flavor, originType, originId, investigationFocus, teamCodes, onClose,
}: Props) {
  const [estimate, setEstimate] = useState<{ messageCount: number; sessionCount: number } | null>(null)
  const [running,  setRunning]  = useState<ScanMode | null>(null)
  const [result,   setResult]   = useState<ScanResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEstimate(null); setResult(null); setError(null)
    fetch(`/api/investigation-scan?workspaceId=${workspaceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setEstimate(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId, anchorId])

  async function runScan(mode: ScanMode) {
    setRunning(mode)
    setError(null)
    try {
      const res = await fetch('/api/investigation-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          workspaceId,
          investigationFocus,
          anchor: { kind: anchorKind, id: anchorId, title, originAgentRole, flavor, originType, originId },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Scan failed.')
        return
      }
      setResult({ ...data, ranAs: mode })
    } catch {
      setError('Scan failed — network or server error.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col flex-1 min-w-0 bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {anchorKindLabel}
          </span>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight truncate">{title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {meta.projectName ?? '—'} · {teamLabel(meta.teamId, meta.teamName, teamCodes)} · {meta.wsName}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Botones — NO tabs, botones reales separados (mockup corrigió confusión de tabs anterior) */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => runScan('session_scan')}
              disabled={running !== null}
              className="ui-button ui-button-primary min-h-8 px-4 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running === 'session_scan' ? 'Scanning…' : 'Session Scan'}
            </button>
            <InfoTooltip text="Analyzes only the session where this result originated." />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => runScan('deep_search')}
              disabled={running !== null}
              className="ui-button ui-button-primary min-h-8 px-4 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running === 'deep_search' ? 'Scanning…' : 'Deep Search'}
            </button>
            <InfoTooltip text="Analyzes all sessions in this Workspace — may use more tokens." />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-center gap-2">
          <span aria-hidden="true">⚠</span>
          <span>
            Deep Search scans all {estimate ? estimate.sessionCount : 3} workspace sessions
            {estimate ? ` (~${estimate.messageCount} messages)` : ''} — may use more tokens.
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        )}

        {running && !result && (
          <p className="text-xs text-[var(--color-text-muted)]">Running {running === 'session_scan' ? 'Session Scan' : 'Deep Search'}…</p>
        )}

        {result && (
          <>
            {/* Verdict */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                Verdict <InfoTooltip text="Whether the evidence found supports, partially supports, contradicts, or is insufficient to answer the investigation focus." />
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {VERDICT_CARDS.map(v => (
                  <div
                    key={v.key}
                    className={`rounded-xl border px-3 py-2.5 text-center ${result.verdict === v.key ? v.activeClassName : v.className}`}
                  >
                    <p className="text-sm font-bold">{v.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-80">{v.hint}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Justification */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Justification Summary
              </p>
              <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">{result.justification}</p>
            </div>

            {/* Evidence Used */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Evidence Used ({result.evidence.length})
              </p>
              {result.evidence.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">No specific evidence was cited.</p>
              ) : (
                <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-4 py-3 space-y-2.5">
                  {result.evidence.map((e, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">{e.source}</span>
                        {e.timestamp && <span className="text-[10px] text-[var(--color-text-muted)] shrink-0" suppressHydrationWarning>{e.timestamp}</span>}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">&ldquo;{e.excerpt}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scope transparency — fuente de verdad real de esta corrida, nunca
                estática. Debe reflejar exactamente sourcesScanned/sourcesNotScanned
                devueltos por el endpoint para ESTE resultado (ver nota de Agus,
                2026-08-20: no puede contradecir lo que el tooltip genérico sugiere). */}
            <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-3 py-2.5 text-[11px] flex items-start gap-2">
              <span className="shrink-0 mt-0.5" aria-hidden="true">ℹ</span>
              <div className="space-y-1">
                <p>
                  <span className="font-semibold text-emerald-700">Scanned:</span>{' '}
                  {result.sourcesScanned.length ? result.sourcesScanned.map(s => s.label).join(', ') : 'None'}
                </p>
                <p>
                  <span className="font-semibold text-gray-500">Not scanned:</span>{' '}
                  {result.sourcesNotScanned.length ? result.sourcesNotScanned.map(s => s.label).join(', ') : 'None — all workspace sessions were scanned.'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
