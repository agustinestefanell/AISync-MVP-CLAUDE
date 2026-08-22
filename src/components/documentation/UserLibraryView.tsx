'use client'

import { useMemo, useState } from 'react'
import type { DocSavedSelection, DocTag } from '@/lib/db/documentation'

// ── User Library (2026-08-21) — reemplaza Structure View como tab de
// Documentation Mode. Basada ÚNICAMENTE en Save Selection, organizada por
// tags manuales libres (no carpetas anidadas) — migración 058. Un Save
// Selection puede tener varios tags. "Estar en la library" se deriva de
// tener al menos 1 tag (sin columna in_user_library, ver DECISIONS.md
// 2026-08-21) — por eso el estado vacío se calcula sobre selecciones CON
// tags, no sobre la existencia de tags sueltos.

// Texto exacto pedido por Agus, bilingüe (inglés primero) — usado tanto acá
// (estado vacío) como en el ícono "i" de esta vista (DocClient.tsx TABS),
// desde una sola fuente para que nunca queden desincronizados.
export const USER_LIBRARY_GUIDE =
  `Organize your material extracted from chats with the AI here, through the 'Save Selection' command. Use your own Tags to organize the information.

Organiza aquí tu material extraído de los chats con la IA a través del comando 'Save Selection'. Usa tus propios Tags para organizar la información.`

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function teamLabel(id: string | null, name: string | null, codes?: Record<string, string>): string {
  if (!name) return '—'
  const code = id ? codes?.[id] : undefined
  return code ? `${code} · ${name}` : name
}

interface Props {
  savedSelections: DocSavedSelection[]
  tags: DocTag[]
  teamCodes?: Record<string, string>
}

export default function UserLibraryView({ savedSelections, tags, teamCodes }: Props) {
  // Multi-select — cada tag marcado SUMA una restricción (AND, no OR): con 0
  // tags marcados se ven todos los Save Selections de la library; marcar más
  // de uno acota más, no amplía (2026-08-21, ajuste de UX post-verificación).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagSearchQuery, setTagSearchQuery] = useState('')

  const isLibraryEmpty = useMemo(
    () => !savedSelections.some(ss => ss.tags.length > 0),
    [savedSelections],
  )

  const countByTag = useMemo(() => {
    const m = new Map<string, number>()
    for (const ss of savedSelections) {
      for (const t of ss.tags) m.set(t.id, (m.get(t.id) ?? 0) + 1)
    }
    return m
  }, [savedSelections])

  // Orden alfabético (A-Z) — no por conteo ni por fecha de creación.
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  )

  // Buscador de tags: "contains" (no solo "empieza con") — "DO" matchea
  // "Todo" tanto como "Documentation". Client-side, sobre los tags ya
  // cargados, sin query nueva.
  const visibleTags = useMemo(() => {
    const q = tagSearchQuery.trim().toLowerCase()
    if (!q) return sortedTags
    return sortedTags.filter(t => t.name.toLowerCase().includes(q))
  }, [sortedTags, tagSearchQuery])

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])
  }

  // Sin tags marcados → todos los Save Selections de la library (los que
  // tienen ≥1 tag). Con tags marcados → deben tener TODOS los marcados.
  const filteredSelections = useMemo(() => {
    const inLibrary = savedSelections.filter(ss => ss.tags.length > 0)
    const base = selectedTagIds.length === 0
      ? inLibrary
      : inLibrary.filter(ss => selectedTagIds.every(tagId => ss.tags.some(t => t.id === tagId)))
    return [...base].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [savedSelections, selectedTagIds])

  if (isLibraryEmpty) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] px-8 py-10 text-center">
          <p className="text-3xl mb-4" aria-hidden="true">🏷️</p>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed">
            {USER_LIBRARY_GUIDE}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Panel izquierdo: buscador + lista de tags (A-Z), multi-select */}
      <div className="w-72 shrink-0 border-r border-[var(--color-border-subtle)] flex flex-col min-h-0">
        <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Tags ({sortedTags.length})
            </p>
            {selectedTagIds.length > 0 && (
              <button
                onClick={() => setSelectedTagIds([])}
                className="text-xs text-[var(--color-accent)] hover:opacity-75"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            value={tagSearchQuery}
            onChange={e => setTagSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-border-focus)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleTags.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[var(--color-text-muted)]">No tags match &ldquo;{tagSearchQuery}&rdquo;.</p>
          ) : visibleTags.map(tag => {
            const count = countByTag.get(tag.id) ?? 0
            const active = selectedTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? 'bg-white border-white' : 'border-gray-300'}`}>
                  {active && <span className="text-[10px] leading-none font-bold text-[var(--color-accent)]">✓</span>}
                </span>
                <span className="truncate flex-1">{tag.name}</span>
                <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${active ? 'bg-white/20' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: grid vertical — sin tags marcados, todos los Save
          Selections de la library; marcar tags acota (AND, no OR). Varias
          cards por fila, scroll vertical normal, sin carrusel/flechas. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {filteredSelections.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No Save Selections match the tags selected.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
            {filteredSelections.map(ss => (
              <div
                key={ss.id}
                className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 flex flex-col"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 bg-amber-50 border-amber-200">
                    SAVE SELECTION
                  </span>
                  <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{ss.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {teamLabel(ss.team_id, ss.team_name, teamCodes)} · {ss.workspace_name} · <span suppressHydrationWarning>{formatDate(ss.created_at)}</span> · {ss.message_count} message{ss.message_count !== 1 ? 's' : ''}
                </p>
                {ss.content_preview && (
                  <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{ss.content_preview}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ss.tags.map(t => (
                    <span key={t.id} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
                      {t.name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => window.open(`/workspace/${ss.workspace_id}`, '_blank', 'noopener,noreferrer')}
                  className="mt-3 self-start px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90"
                >
                  Open Workspace →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
