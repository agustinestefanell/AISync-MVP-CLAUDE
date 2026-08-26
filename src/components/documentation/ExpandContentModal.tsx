'use client'

import { useEffect, useState } from 'react'

// Modal "Expandir" genérico — extraído del patrón que ya vivía duplicado en
// UserLibraryView.tsx (Expandir de Save Selection) y en el mismo estilo
// visual de EditTeamModal.tsx (overlay + header/body scrolleable/footer).
// Usado primero por Investigate View ("Open Evidence", 2026-08-26) —
// UserLibraryView sigue con su propia copia inline (fuera de alcance de esa
// OE migrarla, señalado como candidato a futuro en el handoff).

interface EvidenceMessage {
  role?:       string
  content?:    string
  agent_role?: string
}

interface Props {
  title:     string
  subtitle?: string
  fetchUrl:  string
  onClose:   () => void
}

export default function ExpandContentModal({ title, subtitle, fetchUrl, onClose }: Props) {
  const [messages, setMessages] = useState<EvidenceMessage[] | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages(null)
    fetch(fetchUrl)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setMessages(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setMessages([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchUrl])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="shrink-0 px-6 py-3.5 border-b border-[var(--color-border-default)] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2 shrink-0">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : !messages || messages.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No content.</p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                  {m.agent_role ?? m.role ?? 'message'}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{m.content ?? ''}</p>
              </div>
            ))
          )}
        </div>
        <div className="shrink-0 px-6 py-3.5 border-t border-[var(--color-border-default)] flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-4 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
