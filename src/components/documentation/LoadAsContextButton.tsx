'use client'

import { useEffect, useState } from 'react'
import type { ProjectWithTeams } from '@/lib/db/types'

// Botón compartido "Load as Context" (→ Context Files) — usado en Repository
// View, Audit View, Investigate View y User Library (2026-08-26). Único lugar
// que resuelve contenido + POST /api/context + confirmación con destino real
// (Team/Project) — evita repetir la misma lógica async en 4+ paneles.
// Alcance: solo "→ Context Files", sin "→ Chat" (decisión de producto — ver
// handoff — requeriría un selector de Workspace/sesión aparte).
//
// Selector de destino (2026-08-26, corrección) — el primer intento resolvía
// Team/Project automáticamente sin preguntar; el pedido real es un selector
// chico que ARRANCA en el Project/Team de origen del ancla pero permite
// cambiar a cualquier otro Project/Team 100% propio del usuario. Los Teams
// 'isolated' (Connected/Shared Teams) se excluyen siempre de las opciones —
// riesgo de seguridad cross-cuenta, no se ofrecen como destino posible.

function roleLabel(role?: string): string {
  return role === 'assistant' ? 'Assistant' : 'User'
}
function joinMessages(messages: { role?: string; content?: string }[]): string {
  return messages.map(m => `${roleLabel(m.role)}: ${m.content ?? ''}`).join('\n\n')
}

interface Props {
  title:           string
  evidenceUrl:     string
  contextOrigin:   { originType: 'checkpoint' | 'handoff_package' | 'saved_selection'; originId: string }
  workspaceId:     string
  projects:        ProjectWithTeams[]
  originProjectId: string | null
  originTeamId:    string | null
  className?:      string
}

export default function LoadAsContextButton({
  title, evidenceUrl, contextOrigin, workspaceId, projects, originProjectId, originTeamId, className,
}: Props) {
  const [open,             setOpen]             = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTeamId,    setSelectedTeamId]    = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  // Confirmación temporal ("toast") — se auto-oculta, mismo criterio de
  // feedback puntual ya usado en el resto de la app (ej. "Loaded ✓" de
  // LoadContextModal/UserLibraryView).
  useEffect(() => {
    if (!confirmation) return
    const t = setTimeout(() => setConfirmation(null), 6000)
    return () => clearTimeout(t)
  }, [confirmation])

  function eligibleTeamsFor(projectId: string) {
    return (projects.find(p => p.id === projectId)?.teams ?? []).filter(t => t.type !== 'isolated')
  }

  function openSelector() {
    setError(null)
    setConfirmation(null)
    const initialProjectId = originProjectId && projects.some(p => p.id === originProjectId)
      ? originProjectId
      : projects[0]?.id ?? ''
    const initialTeams = eligibleTeamsFor(initialProjectId)
    const initialTeamId = initialTeams.some(t => t.id === originTeamId) ? (originTeamId ?? '') : (initialTeams[0]?.id ?? '')
    setSelectedProjectId(initialProjectId)
    setSelectedTeamId(initialTeamId)
    setOpen(true)
  }

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId)
    setSelectedTeamId(eligibleTeamsFor(projectId)[0]?.id ?? '')
  }

  const teamsForSelectedProject = eligibleTeamsFor(selectedProjectId)
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null
  const selectedTeam    = teamsForSelectedProject.find(t => t.id === selectedTeamId) ?? null

  async function handleConfirm() {
    if (!selectedProject || !selectedTeam) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(evidenceUrl)
      if (!res.ok) throw new Error('Failed to load content')
      const msgs = await res.json() as { role?: string; content?: string }[]
      const contentText = joinMessages(Array.isArray(msgs) ? msgs : [])
      if (!contentText.trim()) throw new Error('This item has no content to load.')

      const postRes = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          contentText,
          scope:           'team',
          teamId:          selectedTeam.id,
          sessionId:       null,
          workspaceId,
          projectId:       selectedProject.id,
          originType:      contextOrigin.originType,
          originMessageId: contextOrigin.originId,
        }),
      })
      if (!postRes.ok) {
        const body = await postRes.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to load as context')
      }
      setConfirmation(`Loaded to Context Files — Team: ${selectedTeam.name}, Project: ${selectedProject.name}`)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load as context')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`relative flex flex-col items-start gap-1.5 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openSelector())}
        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-indigo-300 hover:text-[var(--color-text-primary)] transition-colors"
      >
        Load as Context
      </button>

      {open && (
        <div
          className="absolute z-20 top-full left-0 mt-1 w-72 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] shadow-lg p-3 space-y-2.5"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Load to Context Files</p>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">Project</label>
            <select
              value={selectedProjectId}
              onChange={e => handleProjectChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-500"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">Team</label>
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              disabled={teamsForSelectedProject.length === 0}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {teamsForSelectedProject.length === 0
                ? <option value="">No eligible teams</option>
                : teamsForSelectedProject.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {teamsForSelectedProject.length === 0 && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                This project has no teams available as a destination (Connected/Shared Teams are excluded).
              </p>
            )}
          </div>

          {error && (
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !selectedTeam}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {confirmation && (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">{confirmation}</p>
      )}
    </div>
  )
}
