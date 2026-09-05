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

export interface LoadToChatProvenance {
  // 'review_forward' se agrega en Fase 1.6 — reutilizado por
  // AgentPanelHandle.appendUserMessage (WorkspaceShell.tsx), no exclusivo
  // de Load Saved Context pese al nombre del tipo.
  source_object_type: 'checkpoint' | 'handoff_package' | 'saved_selection' | 'review_forward'
  source_object_id:   string
}

interface Props {
  open:         boolean
  onClose:      () => void
  projectId?:   string
  teamId?:      string
  workspaceId?: string
  sessionId?:   string
  // Inyecta el contenido directamente como próximo turno del usuario en el
  // chat visible (mismo mecanismo que AgentPanelHandle.appendUserMessage).
  // provenance viaja hasta la persistencia del mensaje (message_provenance,
  // migración 054) — ver AgentPanel.tsx handleLoadToChat/sendPrompt.
  onLoadToChat: (content: string, provenance: LoadToChatProvenance) => void
  // Human Chat (Connected Teams, 2026-08-26): no hay sesión de agente ni
  // destino "Context Files" con sentido (no hay team/session propios de un
  // agente a los que asociar el archivo) — oculta el selector de scope, el
  // checkbox y el botón "→ Context Files", deja solo "→ Chat" por ítem, de a
  // 1 (sin selección múltiple). Ver HumanChatPanel.tsx.
  chatOnly?:    boolean
}

type Destination = 'context_files' | 'chat'

const TYPE_LABEL: Record<ItemType, string> = {
  checkpoint: 'Checkpoint',
  handoff:    'Handoff Package',
  selection:  'Saved Selection',
}

function itemKey(item: Pick<BrowseItem, 'type' | 'id'>): string {
  return `${item.type}-${item.id}`
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

export default function LoadContextModal({ open, onClose, projectId, teamId, workspaceId, sessionId, onLoadToChat, chatOnly = false }: Props) {
  const [items,    setItems]    = useState<BrowseItem[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [filterProject, setFilterProject] = useState('')
  const [filterTeam,    setFilterTeam]    = useState('')
  const [filterType,    setFilterType]    = useState<ItemType | ''>('')
  const [filterDate,    setFilterDate]    = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')

  const [scope,     setScope]     = useState<'session' | 'team' | 'project'>('session')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Selección múltiple (solo !chatOnly — chatOnly nunca tuvo checkbox ni
  // destino Context Files). Sin toggle de destino a nivel modal: cada card
  // conserva sus 2 botones ("→ Context Files"/"→ Chat"), pero ahora actúan
  // sobre el conjunto tildado si hay alguno (ver targetsFor), no solo sobre
  // sí misma. "→ Chat" se deshabilita con 2+ tildados (ver isChatDisabled) —
  // sin aviso de rechazo, el botón simplemente no es clickeable.
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [contextLoading,  setContextLoading]  = useState(false)
  const [successMessage,  setSuccessMessage]  = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFilterProject('')
    setFilterTeam('')
    setFilterType('')
    setFilterDate('')
    setSearchQuery('')
    setScope('session')
    setLoadError(null)
    setSelectedIds(new Set())
    setSuccessMessage(null)
    loadItems()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!successMessage) return
    const t = setTimeout(() => setSuccessMessage(null), 6000)
    return () => clearTimeout(t)
  }, [successMessage])

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

  // Audit log fail-open — mismo criterio que el resto del proyecto, nunca
  // bloquea ni falla la acción principal si el registro no se pudo escribir.
  function logAudit(item: BrowseItem, destination: Destination) {
    if (!workspaceId) return
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        event_type: 'context_loaded_from_documentation',
        metadata: {
          source_type:       originType[item.type],
          source_id:         item.id,
          source_name:       item.name,
          target_session_id: sessionId ?? null,
          destination,
        },
      }),
    }).catch(console.error)
  }

  async function loadItemToContextFiles(item: BrowseItem): Promise<void> {
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
    // /api/context ya registra su propio audit log server-side — no duplicar acá.
  }

  async function handleLoadToChat(item: BrowseItem) {
    setLoadingId(item.id)
    setLoadError(null)
    try {
      const contentText = await buildContentForItem(item)
      if (!contentText.trim()) {
        throw new Error('This item has no content to load.')
      }
      const prefixed = `[Loaded from Documentation Mode — ${TYPE_LABEL[item.type]}: ${item.name}]\n\n${contentText}`
      onLoadToChat(prefixed, { source_object_type: originType[item.type], source_object_id: item.id })
      logAudit(item, 'chat')
      // El usuario quiere seguir trabajando esto en el chat de inmediato
      onClose()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load as context')
    } finally {
      setLoadingId(null)
    }
  }

  function toggleSelect(item: BrowseItem) {
    const key = itemKey(item)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // El botón que se clickeó no necesariamente es el objetivo: con selección
  // activa, cualquier botón "→ Context Files"/"→ Chat" de cualquier card
  // actúa sobre TODO lo tildado (pedido explícito de Agus). Sin nada
  // tildado, cae al comportamiento original — solo esa card.
  function targetsFor(item: BrowseItem): BrowseItem[] {
    if (selectedIds.size === 0) return [item]
    return filtered.filter(it => selectedIds.has(itemKey(it)))
  }

  async function handleContextFilesClick(item: BrowseItem) {
    const targets = targetsFor(item)
    if (targets.length === 0) return

    setContextLoading(true)
    setLoadError(null)
    setSuccessMessage(null)
    const failedNames: string[] = []
    const succeededKeys = new Set<string>()
    for (const target of targets) {
      try {
        await loadItemToContextFiles(target)
        succeededKeys.add(itemKey(target))
      } catch {
        failedNames.push(target.name)
      }
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      succeededKeys.forEach(k => next.delete(k))
      return next
    })
    if (failedNames.length === 0) {
      setSuccessMessage(`Loaded ${targets.length} item${targets.length > 1 ? 's' : ''} to Context Files.`)
    } else {
      setLoadError(
        `Failed to load: ${failedNames.join(', ')}.${succeededKeys.size ? ` (${succeededKeys.size} loaded successfully.)` : ''}`
      )
    }
    setContextLoading(false)
  }

  async function handleChatClick(item: BrowseItem) {
    const targets = targetsFor(item)
    if (targets.length !== 1) return // defensivo — el botón ya está deshabilitado con 2+
    await handleLoadToChat(targets[0])
    setSelectedIds(new Set())
  }

  // "→ Chat" solo admite 0 o 1 tildado a la vez — con 2+, el botón queda
  // deshabilitado en TODAS las cards (autoexplicativo, sin aviso aparte).
  const isChatDisabled = selectedIds.size >= 2

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
        {!chatOnly && successMessage && (
          <div className="mx-5 mt-3 shrink-0 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {successMessage}
          </div>
        )}

        {/* Scope selector — mismo patrón que Add Context File. Solo aplica al destino "Context Files". */}
        {!chatOnly && (
          <div className="px-5 pt-3 shrink-0">
            <label className="text-xs text-gray-400 mb-1.5 block">Context Files scope <span className="text-gray-500 normal-case">(only applies when loading to Context Files)</span></label>
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
        )}

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
                <li
                  key={itemKey(it)}
                  onClick={!chatOnly ? () => toggleSelect(it) : undefined}
                  className={`border border-gray-200 rounded-lg px-3 py-2.5 ${!chatOnly ? 'cursor-pointer hover:border-indigo-300' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {!chatOnly && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(itemKey(it))}
                        onChange={() => toggleSelect(it)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 mt-1 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select ${it.name}`}
                      />
                    )}
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
                    <div className="shrink-0 flex flex-col gap-1">
                      {!chatOnly && (
                        <button
                          onClick={e => { e.stopPropagation(); handleContextFilesClick(it) }}
                          disabled={contextLoading || loadingId !== null}
                          title="Keep it as background context for this session"
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {contextLoading ? 'Loading…' : '→ Context Files'}
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleChatClick(it) }}
                        disabled={loadingId !== null || contextLoading || (!chatOnly && isChatDisabled)}
                        title={!chatOnly && isChatDisabled ? 'Chat can only load 1 item at a time' : 'Inject it as a message and start working on it now'}
                        className={chatOnly
                          ? 'text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                          : 'text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'}
                      >
                        {loadingId !== null ? 'Loading…' : '→ Chat'}
                      </button>
                    </div>
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
