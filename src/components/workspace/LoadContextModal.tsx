'use client'

import { useState, useEffect, useMemo } from 'react'

type ItemType = 'checkpoint' | 'handoff' | 'selection'

interface BrowseItem {
  type:             ItemType
  id:               string
  name:             string
  team_id:          string | null
  team_name:        string | null
  project_id:       string | null
  project_name:     string | null
  created_at:       string
  content_preview?: string
}

interface DetailMessage {
  role?:    string
  content?: string
}

interface Props {
  open:         boolean
  onClose:      () => void
  projectId?:   string
  teamId?:      string
  workspaceId?: string
  sessionId?:   string
}

const TYPE_LABEL: Record<ItemType, string> = {
  checkpoint: 'Checkpoint',
  handoff:    'Handoff Package',
  selection:  'Saved Selection',
}

function roleLabel(role?: string): string {
  return role === 'assistant' ? 'Assistant' : 'User'
}

// Une los mensajes en el mismo formato "Role: content" ya usado en Review &
// Forward y en los adjuntos Office — consistente con el resto de la app.
function joinMessages(messages: DetailMessage[]): string {
  return messages
    .map(m => `${roleLabel(m.role)}: ${m.content ?? ''}`)
    .join('\n\n')
}

export default function LoadContextModal({ open, onClose, projectId, teamId, workspaceId, sessionId }: Props) {
  const [items,    setItems]    = useState<BrowseItem[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [filterProject, setFilterProject] = useState(projectId ?? '')
  const [filterTeam,    setFilterTeam]    = useState('')
  const [filterType,    setFilterType]    = useState<ItemType | ''>('')
  const [filterDate,    setFilterDate]    = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')

  const [scope,     setScope]     = useState<'session' | 'team' | 'project'>('session')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadedId,  setLoadedId]  = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFilterProject(projectId ?? '')
    setFilterTeam('')
    setFilterType('')
    setFilterDate('')
    setSearchQuery('')
    setScope('session')
    setLoadError(null)
    setLoadedId(null)
    loadItems()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/documentation/browse')
      if (!res.ok) throw new Error('Failed to load saved context')
      const data = await res.json() as {
        checkpoints:     Array<{ id: string; name: string; team_id: string; team_name: string; project_id: string; project_name: string; created_at: string; content_preview?: string }>
        handoffPackages: Array<{ id: string; name: string; team_id: string | null; team_name: string | null; project_id: string | null; project_name: string | null; created_at: string; content_preview?: string }>
        savedSelections: Array<{ id: string; name: string; team_id: string | null; team_name: string | null; project_id: string | null; project_name: string | null; created_at: string; content_preview?: string }>
        projects:        { id: string; name: string }[]
      }
      const combined: BrowseItem[] = [
        ...data.checkpoints.map(c => ({ ...c, type: 'checkpoint' as const })),
        ...data.handoffPackages.map(h => ({ ...h, type: 'handoff' as const })),
        ...data.savedSelections.map(s => ({ ...s, type: 'selection' as const })),
      ]
      setItems(combined)
      setProjects(data.projects)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved context')
    } finally {
      setLoading(false)
    }
  }

  const uniqueTeams = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of items) {
      if (!it.team_id) continue
      if (filterProject && it.project_id !== filterProject) continue
      m.set(it.team_id, it.team_name ?? '')
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [items, filterProject])

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (filterProject && it.project_id !== filterProject) return false
      if (filterTeam    && it.team_id    !== filterTeam)    return false
      if (filterType    && it.type       !== filterType)    return false
      if (filterDate    && !it.created_at.startsWith(filterDate)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const haystack = `${it.name} ${it.content_preview ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [items, filterProject, filterTeam, filterType, filterDate, searchQuery])

  // Carga diferenciada por tipo (Mini-OE 2026-08-03):
  // Saved Selection y Checkpoint -> contenido completo.
  // Handoff Package -> SOLO el último mensaje (la conclusión), nunca el
  // intercambio completo — los mensajes previos son para entender CÓMO se
  // llegó ahí (útil en Documentation Mode), no para inyectarlos como contexto.
  async function buildContentForItem(item: BrowseItem): Promise<string> {
    if (item.type === 'selection') {
      const res = await fetch(`/api/documentation/selection/${item.id}`)
      if (!res.ok) throw new Error('Failed to load selection content')
      const messages = await res.json() as DetailMessage[]
      return joinMessages(messages)
    }
    if (item.type === 'checkpoint') {
      const res = await fetch(`/api/documentation/checkpoint/${item.id}`)
      if (!res.ok) throw new Error('Failed to load checkpoint content')
      const messages = await res.json() as DetailMessage[]
      return joinMessages(messages)
    }
    const res = await fetch(`/api/documentation/handoff/${item.id}`)
    if (!res.ok) throw new Error('Failed to load handoff content')
    const messages = await res.json() as DetailMessage[]
    const last = messages[messages.length - 1]
    return last ? `${roleLabel(last.role)}: ${last.content ?? ''}` : ''
  }

  const originType: Record<ItemType, 'checkpoint' | 'handoff_package' | 'saved_selection'> = {
    checkpoint: 'checkpoint',
    handoff:    'handoff_package',
    selection:  'saved_selection',
  }

  async function handleLoad(item: BrowseItem) {
    setLoadingId(item.id)
    setLoadError(null)
    setLoadedId(null)
    try {
      const contentText = await buildContentForItem(item)
      if (!contentText.trim()) {
        throw new Error('This item has no content to load.')
      }

      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           item.name,
          contentText,
          scope,
          teamId:          teamId      ?? null,
          sessionId:       sessionId   ?? null,
          workspaceId:     workspaceId ?? null,
          projectId:       projectId   ?? null,
          originType:      originType[item.type],
          originMessageId: item.id,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to load as context')
      }

      setLoadedId(item.id)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load as context')
    } finally {
      setLoadingId(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Load Saved Context</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Bring a Handoff Package, Saved Selection, or Checkpoint into this conversation.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[var(--color-text-primary)] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 shrink-0 text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {loadError && (
          <div className="mx-5 mt-3 shrink-0 text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
            {loadError}
          </div>
        )}

        {/* Scope selector — mismo patrón que Add Context File */}
        <div className="px-5 pt-3 shrink-0">
          <label className="text-xs text-gray-400 mb-1.5 block">Load into scope</label>
          <div className="flex gap-2">
            {(['session', 'team', 'project'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                  scope === s
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-500'
                }`}
              >
                {s === 'session' ? 'Session' : s === 'team' ? 'Team' : 'Project'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {scope === 'session' && 'Available only in this agent session.'}
            {scope === 'team'    && 'Available to all agents in this team.'}
            {scope === 'project' && 'Available across all teams in the project.'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 px-5 py-3 shrink-0">
          <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setFilterTeam('') }}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
            <option value="">All teams</option>
            {uniqueTeams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as ItemType | '')}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
            <option value="">All types</option>
            <option value="checkpoint">Checkpoint</option>
            <option value="handoff">Handoff Package</option>
            <option value="selection">Saved Selection</option>
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or content…"
            className="flex-1 min-w-[160px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
          {loading ? (
            <p className="text-xs text-gray-500 py-4">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No saved items match these filters.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map(it => (
                <li key={`${it.type}-${it.id}`} className="border border-gray-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                          {TYPE_LABEL[it.type]}
                        </span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{it.name}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {it.team_name ?? '—'} · {it.project_name ?? '—'} · {new Date(it.created_at).toLocaleDateString()}
                      </p>
                      {it.content_preview && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{it.content_preview}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleLoad(it)}
                      disabled={loadingId === it.id}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingId === it.id ? 'Loading…' : loadedId === it.id ? 'Loaded ✓' : 'Load'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
