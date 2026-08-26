'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DocSavedSelection, DocTag } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import LoadAsContextButton from './LoadAsContextButton'
import ExpandContentModal from './ExpandContentModal'

// ── User Library (2026-08-21) — reemplaza Structure View como tab de
// Documentation Mode. Basada ÚNICAMENTE en Save Selection, organizada por
// tags manuales libres (no carpetas anidadas) — migración 058. Un Save
// Selection puede tener varios tags. "Estar en la library" se deriva de
// tener al menos 1 tag (sin columna in_user_library, ver DECISIONS.md
// 2026-08-21) — por eso el estado vacío se calcula sobre selecciones CON
// tags, no sobre la existencia de tags sueltos.
//
// Ajustes 2026-08-22: layout de 4 columnas manuales (round-robin, no CSS
// Grid/Columns — ver COLUMN_MAX_HEIGHTS/useColumnCount), cada columna con su
// propio tope de altura REAL en píxeles (TruncatedPreview mide scrollHeight
// vs clientHeight), modal de "Expandir" (contenido completo), edición por
// card (Delete/Add Tag/Remove tag), edición de tags desde el panel izquierdo
// (Add a New Tag/Edit Tag con color, migración 059) y filtros Project/Team
// (AND con el filtro de tags). Todas las mutaciones llaman al backend y
// luego router.refresh() — mismo patrón ya usado por TeamsClient.tsx/
// EditTeamModal.tsx — en vez de duplicar el estado del servidor en local
// state.

// Texto exacto pedido por Agus, bilingüe (inglés primero) — usado tanto acá
// (estado vacío) como en el ícono "i" de esta vista (DocClient.tsx TABS),
// desde una sola fuente para que nunca queden desincronizados.
export const USER_LIBRARY_GUIDE =
  `Organize your material extracted from chats with the AI here, through the 'Save Selection' command. Use your own Tags to organize the information.

Organiza aquí tu material extraído de los chats con la IA a través del comando 'Save Selection'. Usa tus propios Tags para organizar la información.`

// Paleta fija (no color picker libre) — usada tanto en "Edit Tag" como
// default de tags creados antes de la migración 059.
const TAG_COLORS = ['#1f4e79', '#B45309', '#047857', '#7C3AED', '#DC2626', '#0891B2', '#DB2777', '#4B5563']
const DEFAULT_TAG_COLOR = TAG_COLORS[0]
// Relleno neutro para chips de tags SIN color asignado en la base (color NULL,
// 2026-08-22) — a propósito distinto de DEFAULT_TAG_COLOR (que es el color
// inicial que ofrece el editor "Edit Tag", no un color "real" del tag).
const NO_COLOR_TAG_BG = '#E5E7EB'

// Contraste automático para chips con fondo pintado (2026-08-22) — luminancia
// percibida estándar (0.299R + 0.587G + 0.114B), texto blanco si < 128 (fondo
// oscuro), negro si >= 128 (fondo claro). Cubre los 8 colores de TAG_COLORS y
// cualquier valor legacy en `tags.color`.
function tagTextColor(hex: string): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 128 ? '#FFFFFF' : '#000000'
}

// Tope de altura por columna, en píxeles reales (2026-08-22, reemplaza el
// corte por cantidad de caracteres de la iteración anterior — ese corte
// fallaba con contenido de muchas líneas cortas, ej. listas de nombres, que
// tienen pocos caracteres pero ocupan muchas líneas). Valores arbitrarios
// para variar el ritmo visual entre columnas — primer valor propuesto,
// ajustar si al verlo en pantalla alguno queda corto/largo. Con menos de 4
// columnas activas (breakpoints chicos) se reusa por índice módulo 4.
const COLUMN_MAX_HEIGHTS = [220, 260, 190, 220]

// Cantidad de columnas activa según viewport — mismos breakpoints que ya
// usaba el layout (sm=640px, lg=1024px) para no perder el colapso responsive
// al pasar de CSS Columns a columnas manuales.
function useColumnCount(): number {
  const [count, setCount] = useState(4)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      setCount(w >= 1024 ? 4 : w >= 640 ? 2 : 1)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return count
}

// Preview con tope de altura REAL (no por caracteres): mide scrollHeight vs
// clientHeight después de montar para saber si el contenido realmente excede
// el tope — así el indicador de "más contenido" solo aparece cuando de
// verdad hay algo cortado, sin importar si el texto tiene pocas líneas
// largas o muchas líneas cortas (el bug que tenía el corte por caracteres).
function TruncatedPreview({ text, maxHeight, onExpand }: { text: string; maxHeight: number; onExpand: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [text, maxHeight])

  return (
    <div className="relative mt-1.5">
      <p
        ref={ref}
        className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-hidden"
        style={{ maxHeight }}
      >
        {text}
      </p>
      {overflowing && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-6"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-surface))' }}
          />
          <button
            onClick={onExpand}
            className="absolute bottom-0 right-0 pl-2 text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-surface)] hover:opacity-75"
          >
            More content — Expand →
          </button>
        </>
      )}
    </div>
  )
}

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
  projects: ProjectWithTeams[]
  teamCodes?: Record<string, string>
}

export default function UserLibraryView({ savedSelections, tags, projects, teamCodes }: Props) {
  const router = useRouter()
  const columnCount = useColumnCount()

  // Multi-select — cada tag marcado SUMA una restricción (AND, no OR): con 0
  // tags marcados se ven todos los Save Selections de la library; marcar más
  // de uno acota más, no amplía (2026-08-21, ajuste de UX post-verificación).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagSearchQuery, setTagSearchQuery] = useState('')

  // ── Filtros Project/Team (2026-08-22) — mismo patrón que RepositoryView.tsx/
  // AuditView.tsx/InvestigateView.tsx: Team depende de Project (se acota a los
  // Teams del Project elegido), y conviven (AND) con el filtro de tags.
  const [filterProject, setFilterProject] = useState('')
  const [filterTeam, setFilterTeam] = useState('')

  // ── Panel de tags: Add a New Tag / Edit Tag (2026-08-22) ──
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [tagPanelError, setTagPanelError] = useState<string | null>(null)

  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState(DEFAULT_TAG_COLOR)
  const [savingTagEdit, setSavingTagEdit] = useState(false)

  // ── Card: Expandir (2026-08-22) ── fetch de contenido delegado a
  // ExpandContentModal (migrado 2026-08-26, ver fix de Markdown crudo).
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Card: Add Tag / Remove tag / Delete (2026-08-22) ──
  const [addTagPopoverFor, setAddTagPopoverFor] = useState<string | null>(null)
  const [addTagBusyId, setAddTagBusyId] = useState<string | null>(null)
  const [cardNewTagName, setCardNewTagName] = useState('')
  const [cardShowNewTagInput, setCardShowNewTagInput] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [removingTagKey, setRemovingTagKey] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  // Fuente única: Projects activos reales de la cuenta (mismo prop que las
  // otras 4 vistas), no solo los que tienen algún Save Selection en la library.
  const uniqueProjects = useMemo(() => projects.map(p => [p.id, p.name] as [string, string]), [projects])
  // Team depende de Project — mismo patrón que RepositoryView.tsx: si hay un
  // Project elegido, la lista de Teams se acota a los que pertenecen a ese Project.
  const uniqueTeams = useMemo(() => {
    const m = new Map<string, string>()
    savedSelections.forEach(s => { if (s.team_id && (!filterProject || s.project_id === filterProject)) m.set(s.team_id, s.team_name ?? '') })
    return Array.from(m.entries()).sort(([idA, nameA], [idB, nameB]) => {
      const codeA = teamCodes?.[idA] ?? nameA
      const codeB = teamCodes?.[idB] ?? nameB
      return codeA.localeCompare(codeB)
    })
  }, [savedSelections, filterProject, teamCodes])

  // Si el Team elegido deja de pertenecer al Project recién elegido, se
  // resetea — evita quedar con una combinación imposible seleccionada.
  useEffect(() => {
    if (filterTeam && !uniqueTeams.some(([id]) => id === filterTeam)) {
      setFilterTeam('')
    }
  }, [filterTeam, uniqueTeams])

  // Sin tags marcados → todos los Save Selections de la library (los que
  // tienen ≥1 tag). Con tags marcados → deben tener TODOS los marcados.
  // Project/Team conviven (AND) con el filtro de tags.
  const filteredSelections = useMemo(() => {
    const inLibrary = savedSelections.filter(ss => ss.tags.length > 0)
    const base = selectedTagIds.length === 0
      ? inLibrary
      : inLibrary.filter(ss => selectedTagIds.every(tagId => ss.tags.some(t => t.id === tagId)))
    const scoped = base.filter(ss => {
      if (filterProject && ss.project_id !== filterProject) return false
      if (filterTeam && ss.team_id !== filterTeam) return false
      return true
    })
    return [...scoped].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [savedSelections, selectedTagIds, filterProject, filterTeam])

  // ── Panel de tags: crear tag nuevo ──
  async function createTagFromPanel() {
    const name = newTagName.trim()
    if (!name || creatingTag) return
    setCreatingTag(true)
    setTagPanelError(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setTagPanelError(body?.error ?? 'Failed to create tag.')
        return
      }
      setNewTagName('')
      setShowNewTagInput(false)
      router.refresh()
    } catch {
      setTagPanelError('Network error — try again.')
    } finally {
      setCreatingTag(false)
    }
  }

  // ── Panel de tags: editar (rename + color) ──
  function startEditTag(tag: DocTag) {
    setEditingTagId(tag.id)
    setEditTagName(tag.name)
    setEditTagColor(tag.color ?? DEFAULT_TAG_COLOR)
    setTagPanelError(null)
  }

  async function saveTagEdit() {
    if (!editingTagId) return
    const name = editTagName.trim()
    if (!name) { setTagPanelError('Tag name cannot be empty.'); return }
    setSavingTagEdit(true)
    setTagPanelError(null)
    try {
      const res = await fetch(`/api/tags/${editingTagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: editTagColor }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setTagPanelError(body?.error ?? 'Failed to update tag.')
        return
      }
      setEditingTagId(null)
      router.refresh()
    } catch {
      setTagPanelError('Network error — try again.')
    } finally {
      setSavingTagEdit(false)
    }
  }

  // ── Card: agregar tag existente o nuevo ──
  async function addTagToSelection(selectionId: string, tagId: string) {
    setAddTagBusyId(tagId)
    setCardError(null)
    try {
      const res = await fetch(`/api/documentation/selection/${selectionId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [tagId] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setCardError(body?.error ?? 'Failed to add tag.')
        return
      }
      router.refresh()
    } catch {
      setCardError('Network error — try again.')
    } finally {
      setAddTagBusyId(null)
    }
  }

  async function createAndAddTag(selectionId: string) {
    const name = cardNewTagName.trim()
    if (!name) return
    setAddTagBusyId('__new__')
    setCardError(null)
    try {
      const createRes = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => null)
        setCardError(body?.error ?? 'Failed to create tag.')
        return
      }
      const tag = await createRes.json() as { id: string }
      const addRes = await fetch(`/api/documentation/selection/${selectionId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [tag.id] }),
      })
      if (!addRes.ok) {
        const body = await addRes.json().catch(() => null)
        setCardError(body?.error ?? 'Failed to add new tag.')
        return
      }
      setCardNewTagName('')
      setCardShowNewTagInput(false)
      router.refresh()
    } catch {
      setCardError('Network error — try again.')
    } finally {
      setAddTagBusyId(null)
    }
  }

  // ── Card: quitar un tag puntual ──
  async function removeTagFromSelection(selectionId: string, tagId: string) {
    const key = `${selectionId}:${tagId}`
    setRemovingTagKey(key)
    setCardError(null)
    try {
      const res = await fetch(`/api/documentation/selection/${selectionId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setCardError(body?.error ?? 'Failed to remove tag.')
        return
      }
      router.refresh()
    } catch {
      setCardError('Network error — try again.')
    } finally {
      setRemovingTagKey(null)
    }
  }

  // ── Card: Delete (saca TODOS los tags — el Save Selection en sí no se borra) ──
  async function deleteFromLibrary(selectionId: string) {
    if (confirmDeleteId !== selectionId) { setConfirmDeleteId(selectionId); return }
    setDeletingId(selectionId)
    setCardError(null)
    try {
      const res = await fetch(`/api/documentation/selection/${selectionId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setCardError(body?.error ?? 'Failed to remove from library.')
        return
      }
      setConfirmDeleteId(null)
      router.refresh()
    } catch {
      setCardError('Network error — try again.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Card: Expandir ──
  function openExpanded(selectionId: string) {
    setExpandedId(selectionId)
  }

  const expandedSelection = expandedId ? savedSelections.find(ss => ss.id === expandedId) ?? null : null

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
      {/* Panel izquierdo: buscador + lista de tags (A-Z), multi-select,
          Add a New Tag / Edit Tag */}
      <div className="w-72 shrink-0 border-r border-[var(--color-border-subtle)] flex flex-col min-h-0">
        <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Tags ({sortedTags.length})
            </p>
            <div className="flex items-center gap-2">
              {selectedTagIds.length > 0 && (
                <button
                  onClick={() => setSelectedTagIds([])}
                  className="text-xs text-[var(--color-accent)] hover:opacity-75"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => { setShowNewTagInput(v => !v); setTagPanelError(null) }}
                className="text-xs font-medium text-[var(--color-accent)] hover:opacity-75"
                title="Add a New Tag"
              >
                + New
              </button>
            </div>
          </div>
          <input
            type="text"
            value={tagSearchQuery}
            onChange={e => setTagSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] outline-none focus:border-[var(--color-border-focus)]"
          />
          {showNewTagInput && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createTagFromPanel() }}
                placeholder="New tag name..."
                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)]"
              />
              <button
                onClick={createTagFromPanel}
                disabled={!newTagName.trim() || creatingTag}
                className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {creatingTag ? '…' : 'Add'}
              </button>
            </div>
          )}
          {tagPanelError && !editingTagId && <p className="text-xs text-red-600">{tagPanelError}</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleTags.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[var(--color-text-muted)]">No tags match &ldquo;{tagSearchQuery}&rdquo;.</p>
          ) : visibleTags.map(tag => {
            const count = countByTag.get(tag.id) ?? 0
            const active = selectedTagIds.includes(tag.id)
            const isEditing = editingTagId === tag.id
            return (
              <div key={tag.id} className="space-y-1">
                <div
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
                  }`}
                >
                  <button onClick={() => toggleTagFilter(tag.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? 'bg-white border-white' : 'border-gray-300'}`}>
                      {active && <span className="text-[10px] leading-none font-bold text-[var(--color-accent)]">✓</span>}
                    </span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color ?? DEFAULT_TAG_COLOR }} aria-hidden="true" />
                    <span className="truncate flex-1">{tag.name}</span>
                  </button>
                  <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${active ? 'bg-white/20' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]'}`}>
                    {count}
                  </span>
                  <button
                    onClick={() => isEditing ? setEditingTagId(null) : startEditTag(tag)}
                    className={`shrink-0 text-xs px-1 ${active ? 'text-white/80 hover:text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                    title="Edit Tag"
                  >
                    ✎
                  </button>
                </div>
                {isEditing && (
                  <div className="ml-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] p-2.5 space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={editTagName}
                      onChange={e => setEditTagName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTagEdit() }}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {TAG_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditTagColor(c)}
                          className={`h-5 w-5 rounded-full border-2 ${editTagColor === c ? 'border-[var(--color-text-primary)]' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    {tagPanelError && <p className="text-xs text-red-600">{tagPanelError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveTagEdit}
                        disabled={savingTagEdit}
                        className="px-3 py-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {savingTagEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingTagId(null)} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: mosaico (CSS columns) — sin tags marcados, todos los
          Save Selections de la library; marcar tags acota (AND, no OR).
          Project/Team conviven con el filtro de tags (AND). */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap gap-2">
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
          {(filterProject || filterTeam) && (
            <button
              onClick={() => { setFilterProject(''); setFilterTeam('') }}
              className="text-xs text-[var(--color-accent)] hover:opacity-75 px-1"
            >
              Clear
            </button>
          )}
        </div>
        {cardError && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">{cardError}</p>
            <button onClick={() => setCardError(null)} className="text-xs text-red-700 hover:opacity-75">✕</button>
          </div>
        )}
        {filteredSelections.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No Save Selections match the filters selected.</p>
        ) : (() => {
            // Columnas manuales (2026-08-22, reemplaza CSS Columns) — round-robin
            // card[i] → columna i % columnCount. Permite controlar exactamente qué
            // card cae en qué columna, cada una con su propio tope de altura fijo
            // (COLUMN_MAX_HEIGHTS) en vez de dejarlo a la heurística del navegador.
            const columns: DocSavedSelection[][] = Array.from({ length: columnCount }, () => [])
            filteredSelections.forEach((ss, i) => columns[i % columnCount].push(ss))

            const renderCard = (ss: DocSavedSelection, colIdx: number) => {
              const attachedIds = new Set(ss.tags.map(t => t.id))
              const addableTags = sortedTags.filter(t => !attachedIds.has(t.id))
              const maxHeight = COLUMN_MAX_HEIGHTS[colIdx % COLUMN_MAX_HEIGHTS.length]
              return (
                <div
                  key={ss.id}
                  className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white shadow-sm px-4 py-3 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 bg-amber-50 border-amber-200">
                          SAVE SELECTION
                        </span>
                      </div>
                      <p
                        className="mt-1 truncate text-[18px] font-bold tracking-tight leading-snug text-[var(--color-text-primary)]"
                        style={{ fontFamily: "Georgia, 'Book Antiqua', Palatino, serif" }}
                      >
                        {ss.name}
                      </p>
                    </div>
                    <button
                      onClick={() => openExpanded(ss.id)}
                      className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border border-[var(--color-border-default)] hover:border-[var(--color-accent)] rounded-lg px-2 py-1 transition-colors"
                      title="Expand"
                    >
                      ⤢
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {teamLabel(ss.team_id, ss.team_name, teamCodes)} · {ss.workspace_name} · <span suppressHydrationWarning>{formatDate(ss.created_at)}</span> · {ss.message_count} message{ss.message_count !== 1 ? 's' : ''}
                  </p>
                  {ss.content_preview_full && (
                    <TruncatedPreview text={ss.content_preview_full} maxHeight={maxHeight} onExpand={() => openExpanded(ss.id)} />
                  )}

                  {/* Tags: chips con color + X para "Remove tag", más "+ Add tag" */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {ss.tags.map(t => {
                      const key = `${ss.id}:${t.id}`
                      // Tags sin color explícito (NULL en la base) no heredan ningún
                      // color por defecto — relleno neutro claro + letra negra, en vez
                      // de pintarse con el accent como si fuera "su" color.
                      const bg = t.color ?? NO_COLOR_TAG_BG
                      const fg = t.color ? tagTextColor(bg) : '#000000'
                      return (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          {t.name}
                          <button
                            onClick={() => removeTagFromSelection(ss.id, t.id)}
                            disabled={removingTagKey === key}
                            title="Remove tag"
                            className="leading-none px-0.5 disabled:opacity-50 hover:opacity-70"
                            style={{ color: fg }}
                          >
                            {removingTagKey === key ? '…' : '×'}
                          </button>
                        </span>
                      )
                    })}
                    <div className="relative">
                      <button
                        onClick={() => {
                          const opening = addTagPopoverFor !== ss.id
                          setAddTagPopoverFor(opening ? ss.id : null)
                          setCardShowNewTagInput(false)
                          setCardNewTagName('')
                        }}
                        className="rounded-full border border-dashed border-[var(--color-border-default)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        + Add tag
                      </button>
                      {addTagPopoverFor === ss.id && (
                        <div className="absolute z-10 top-full left-0 mt-1 w-56 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] shadow-lg p-2.5 space-y-2">
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {addableTags.length === 0 && !cardShowNewTagInput && (
                              <p className="text-xs text-[var(--color-text-muted)]">No more existing tags to add.</p>
                            )}
                            {addableTags.map(t => (
                              <button
                                key={t.id}
                                onClick={() => addTagToSelection(ss.id, t.id)}
                                disabled={addTagBusyId === t.id}
                                className="px-2 py-1 rounded-full text-[11px] border border-gray-200 bg-white text-gray-700 hover:border-[var(--color-accent)] disabled:opacity-50 transition-colors"
                              >
                                {addTagBusyId === t.id ? '…' : t.name}
                              </button>
                            ))}
                          </div>
                          {cardShowNewTagInput ? (
                            <div className="flex gap-1.5">
                              <input
                                autoFocus
                                type="text"
                                value={cardNewTagName}
                                onChange={e => setCardNewTagName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') createAndAddTag(ss.id) }}
                                placeholder="New tag..."
                                className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)]"
                              />
                              <button
                                onClick={() => createAndAddTag(ss.id)}
                                disabled={!cardNewTagName.trim() || addTagBusyId === '__new__'}
                                className="px-2 py-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                {addTagBusyId === '__new__' ? '…' : 'Add'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCardShowNewTagInput(true)}
                              className="text-[11px] font-medium text-[var(--color-accent)] hover:opacity-75"
                            >
                              + Create new tag
                            </button>
                          )}
                          <button
                            onClick={() => setAddTagPopoverFor(null)}
                            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <hr className="mt-3 border-t border-[var(--color-border-subtle)]" />

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => window.open(`/workspace/${ss.workspace_id}`, '_blank', 'noopener,noreferrer')}
                      className="px-3 py-1.5 rounded-lg border-2 border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] text-black text-xs font-medium hover:border-[var(--color-accent)] transition-colors"
                    >
                      Open Workspace →
                    </button>
                    <button
                      onClick={() => deleteFromLibrary(ss.id)}
                      disabled={deletingId === ss.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        confirmDeleteId === ss.id
                          ? 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-600'
                          : 'border-2 border-red-900 text-red-600 hover:text-red-400 hover:border-red-700'
                      }`}
                      title="Removes all tags — takes this out of User Library without deleting the Save Selection."
                    >
                      {deletingId === ss.id ? 'Removing…' : confirmDeleteId === ss.id ? 'Confirm?' : 'Delete From Library'}
                    </button>
                  </div>

                  <div className="mt-2">
                    <LoadAsContextButton
                      key={ss.id}
                      title={ss.name}
                      evidenceUrl={`/api/documentation/selection/${ss.id}`}
                      contextOrigin={{ originType: 'saved_selection', originId: ss.id }}
                      workspaceId={ss.workspace_id}
                      projects={projects}
                      originProjectId={ss.project_id}
                      originTeamId={ss.team_id}
                    />
                  </div>
                </div>
              )
            }

            return (
              <div className="flex gap-4 items-start">
                {columns.map((colCards, colIdx) => (
                  <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-4">
                    {colCards.map(ss => renderCard(ss, colIdx))}
                  </div>
                ))}
              </div>
            )
          })()}
      </div>

      {/* Modal Expandir — migrado a ExpandContentModal compartido (2026-08-26,
          ver fix de Markdown crudo) — mismo patrón visual que antes, ahora
          también con react-markdown/remark-gfm. */}
      {expandedSelection && (
        <ExpandContentModal
          title={expandedSelection.name}
          subtitle={`${teamLabel(expandedSelection.team_id, expandedSelection.team_name, teamCodes)} · ${expandedSelection.workspace_name} · ${formatDate(expandedSelection.created_at)}`}
          fetchUrl={`/api/documentation/selection/${expandedSelection.id}`}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  )
}
