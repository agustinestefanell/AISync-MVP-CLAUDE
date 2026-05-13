'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import AgentPanel, { type AgentPanelHandle } from './AgentPanel'
import HandoffPackageModal from './HandoffPackageModal'
import type { Checkpoint, WorkspaceWithAgents, Message } from '@/lib/db/types'
import type { ChatMessage } from '@/lib/providers/types'

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

const PURPOSES = [
  'Checkpoint',
  'Evidencia',
  'Reutilizar',
  'Handoff',
  'Retomar después',
  'Documentación',
  'Soporte de auditoría',
] as const

const PURPOSE_COLORS: Record<string, string> = {
  'Checkpoint':           'text-gray-400 bg-gray-800 border-gray-700',
  'Evidencia':            'text-yellow-400 bg-yellow-950 border-yellow-900',
  'Reutilizar':           'text-blue-400 bg-blue-950 border-blue-900',
  'Handoff':              'text-purple-400 bg-purple-950 border-purple-900',
  'Retomar después':      'text-indigo-400 bg-indigo-950 border-indigo-900',
  'Documentación':        'text-teal-400 bg-teal-950 border-teal-900',
  'Soporte de auditoría': 'text-orange-400 bg-orange-950 border-orange-900',
}

interface Props {
  workspace: WorkspaceWithAgents
  initialMessages: Record<string, Message[]>
  initialCheckpointId?: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function WorkspaceShell({ workspace, initialMessages, initialCheckpointId }: Props) {
  const [lockState, setLockState]       = useState(workspace.lock_state)
  const [lockLoading, setLockLoading]   = useState(false)
  const [showForward, setShowForward]   = useState(false)
  const [fwdTo, setFwdTo]               = useState(workspace.agent_sessions[1]?.id ?? '')
  const [checkpoints, setCheckpoints]   = useState<Checkpoint[]>([])
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>('idle')
  const [resumingId, setResumingId]     = useState<string | null>(null)
  const [totalSelected, setTotalSelected]         = useState(0)
  const [showHandoffModal, setShowHandoffModal]   = useState(false)

  // Modal de Save Version
  const [showSaveModal, setShowSaveModal]   = useState(false)
  const [saveName, setSaveName]             = useState('')
  const [savePurpose, setSavePurpose]       = useState<string>(PURPOSES[0])
  const [nameError, setNameError]           = useState(false)
  const [saveModalError, setSaveModalError] = useState<string | null>(null)

  const panelRefs      = useRef<Record<string, AgentPanelHandle | null>>({})
  const selectionCounts = useRef<Record<string, number>>({})

  // Cargar checkpoints existentes al montar
  useEffect(() => {
    fetch(`/api/checkpoint?workspaceId=${workspace.id}`)
      .then(r => r.json())
      .then(setCheckpoints)
      .catch(() => {})
  }, [workspace.id])

  function getAgentMessages(sessionId: string) {
    return panelRefs.current[sessionId]?.getAllMessages() ?? []
  }

  // ── Lock / Unlock ─────────────────────────────────────────────────────────
  async function handleLockToggle() {
    setLockLoading(true)
    const newState = lockState === 'locked' ? 'unlocked' : 'locked'
    await fetch(`/api/workspace/${workspace.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_state: newState }),
    })
    setLockState(newState)
    setLockLoading(false)
  }

  // ── Contador reactivo de selección ──────────────────────────────────────
  function handleSelectionChange(sessionId: string, count: number) {
    selectionCounts.current[sessionId] = count
    const total = Object.values(selectionCounts.current).reduce((a, b) => a + b, 0)
    setTotalSelected(total)
  }

  function clearAllSelections() {
    for (const session of workspace.agent_sessions) {
      panelRefs.current[session.id]?.clearSelection()
    }
  }

  // ── Review & Forward ──────────────────────────────────────────────────────
  function handleForward() {
    const toRef = panelRefs.current[fwdTo]
    if (!toRef) return

    // Recolectar mensajes seleccionados de todos los paneles, con su etiqueta
    const parts: string[] = []
    for (const session of workspace.agent_sessions) {
      const ref = panelRefs.current[session.id]
      if (!ref) continue
      const selected = ref.getSelectedMessages()
      if (selected.length === 0) continue
      const label = AGENT_LABEL[session.agent_role] ?? session.agent_role
      parts.push(`[${label} — ${session.provider}]:`)
      for (const msg of selected) {
        parts.push(`${msg.role === 'user' ? 'Usuario' : 'Agente'}: ${msg.content}`)
      }
    }

    if (parts.length === 0) return

    toRef.appendUserMessage(parts.join('\n'))
    clearAllSelections()
    setShowForward(false)

    // Audit log (fire and forget)
    const toLabel = AGENT_LABEL[workspace.agent_sessions.find(s => s.id === fwdTo)?.agent_role ?? ''] ?? fwdTo
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        event_type:  'review_forward',
        metadata:    { to_agent: toLabel, message_count: totalSelected },
      }),
    }).catch(() => {})
  }

  // ── Save Version → abre modal con nombre y propósito ─────────────────────
  function openSaveModal() {
    setSaveName('')
    setSavePurpose(PURPOSES[0])
    setNameError(false)
    setSaveModalError(null)
    setShowSaveModal(true)
  }

  function closeSaveModal() {
    setShowSaveModal(false)
    setNameError(false)
    setSaveModalError(null)
  }

  async function confirmSave() {
    if (!saveName.trim()) {
      setNameError(true)
      return
    }

    const panels = workspace.agent_sessions.map(session => ({
      sessionId: session.id,
      messages:  panelRefs.current[session.id]?.getAllMessages() ?? [],
    }))
    const totalMessages = panels.reduce((n, p) => n + p.messages.length, 0)
    if (totalMessages === 0) {
      setSaveModalError('No hay mensajes para guardar en este checkpoint.')
      return
    }

    setSaveStatus('saving')
    setSaveModalError(null)

    try {
      const res = await fetch('/api/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name:        saveName.trim(),
          purpose:     savePurpose,
          panels,
        }),
      })
      const { checkpoint, error } = await res.json()
      if (error) throw new Error(error)

      setCheckpoints(prev => [checkpoint, ...prev])
      setSaveStatus('saved')
      closeSaveModal()
    } catch (err) {
      setSaveModalError(err instanceof Error ? err.message : 'Error al guardar')
      setSaveStatus('idle')
    } finally {
      if (saveStatus === 'saving') {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    }
  }

  // ── Resume Work — restaurar estado desde un checkpoint ───────────────────
  const handleResume = useCallback(async (checkpointId: string, checkpointName: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm(`¿Reemplazar las conversaciones actuales con "${checkpointName}"?`)) return

    setResumingId(checkpointId)
    try {
      const res  = await fetch(`/api/checkpoint/${checkpointId}`)
      const rows = await res.json() as { session_id: string; role: 'user' | 'assistant'; content: string }[]

      // Agrupar por sesión
      const bySession: Record<string, ChatMessage[]> = {}
      for (const row of rows) {
        if (!bySession[row.session_id]) bySession[row.session_id] = []
        bySession[row.session_id].push({ role: row.role, content: row.content })
      }

      // Restaurar cada panel vía handle imperativo
      for (const session of workspace.agent_sessions) {
        panelRefs.current[session.id]?.restoreMessages(bySession[session.id] ?? [])
      }

      // Audit log: resume_work
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          event_type:  'resume_work',
          metadata:    { checkpoint_id: checkpointId, name: checkpointName },
        }),
      })

      setShowCheckpoints(false)
    } finally {
      setResumingId(null)
    }
  }, [workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retomar si llegamos desde el Audit Log con ?checkpoint=X
  useEffect(() => {
    if (!initialCheckpointId) return
    handleResume(initialCheckpointId, 'checkpoint desde Audit Log', true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session Backup — descarga JSON + audit log ────────────────────────────
  async function handleBackup() {
    const data = workspace.agent_sessions.map(session => ({
      agent_role: session.agent_role,
      provider:   session.provider,
      model:      session.model,
      messages:   panelRefs.current[session.id]?.getAllMessages() ?? [],
    }))

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `backup-${workspace.name}-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    // Registrar en audit_log
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        event_type:  'session_backup',
        metadata:    {
          file: `backup-${workspace.name}-${new Date().toISOString().slice(0, 10)}.json`,
          total_messages: data.reduce((n, d) => n + d.messages.length, 0),
        },
      }),
    })
  }

  const locked = lockState === 'locked'

  const saveLabel: Record<SaveStatus, string> = {
    idle:   '💾 Save Version',
    saving: '⏳ Guardando…',
    saved:  '✓ Guardado',
    error:  '✗ Sin mensajes',
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">

      {/* Paneles de agentes */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {workspace.agent_sessions.map(session => (
          <AgentPanel
            key={session.id}
            ref={el => { panelRefs.current[session.id] = el }}
            session={session}
            initialMessages={initialMessages[session.id] ?? []}
            workspaceLocked={locked}
            onSelectionChange={count => handleSelectionChange(session.id, count)}
          />
        ))}
      </div>

      {/* ── Review & Forward UI ── */}
      {showForward && (
        <div className="shrink-0 bg-gray-900 border border-indigo-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
          {totalSelected === 0 ? (
            <p className="text-sm text-gray-500 flex-1">
              Pasá el cursor sobre los mensajes y tildá los checkboxes para seleccionarlos.
            </p>
          ) : (
            <>
              <span className="text-sm text-indigo-300 font-medium">
                {totalSelected} mensaje{totalSelected !== 1 ? 's' : ''} seleccionado{totalSelected !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500">→ reenviar a</span>
              <select
                value={fwdTo}
                onChange={e => setFwdTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
              >
                {workspace.agent_sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {AGENT_LABEL[s.agent_role] ?? s.agent_role} ({s.provider})
                  </option>
                ))}
              </select>
              <button
                onClick={handleForward}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Reenviar {totalSelected}
              </button>
              <button
                onClick={clearAllSelections}
                className="text-gray-500 hover:text-gray-300 text-xs px-2 transition-colors"
              >
                Limpiar selección ✕
              </button>
            </>
          )}
          <button
            onClick={() => setShowForward(false)}
            className="ml-auto text-gray-600 hover:text-gray-400 text-xs transition-colors"
          >
            Cerrar ✕
          </button>
        </div>
      )}

      {/* ── Panel de Checkpoints ── */}
      {showCheckpoints && (
        <div className="shrink-0 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Checkpoints guardados</span>
            <button
              onClick={() => setShowCheckpoints(false)}
              className="text-gray-600 hover:text-gray-400 text-xs"
            >
              Cerrar ✕
            </button>
          </div>

          {checkpoints.length === 0 ? (
            <p className="text-center text-xs text-gray-600 py-6">
              No hay checkpoints guardados para este workspace.
            </p>
          ) : (
            <ul className="divide-y divide-gray-800 max-h-52 overflow-y-auto">
              {checkpoints.map(cp => (
                <li key={cp.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{cp.name}</p>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
                        PURPOSE_COLORS[cp.purpose] ?? 'text-gray-400 bg-gray-800 border-gray-700'
                      }`}>
                        {cp.purpose}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(cp.created_at).toLocaleString('es-AR', {
                        day:    '2-digit',
                        month:  '2-digit',
                        year:   'numeric',
                        hour:   '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResume(cp.id, cp.name)}
                    disabled={resumingId === cp.id}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {resumingId === cp.id ? 'Cargando…' : 'Retomar →'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Toolbar operativo ── */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
        {/* Lock / Unlock */}
        <button
          onClick={handleLockToggle}
          disabled={lockLoading}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
            locked
              ? 'bg-red-950 border border-red-900 text-red-400 hover:bg-red-900'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {locked ? '🔒 Bloqueado' : '🔓 Libre'}
        </button>

        {/* Review & Forward */}
        <button
          onClick={() => { setShowForward(v => !v); setShowCheckpoints(false) }}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
            totalSelected > 0
              ? 'bg-indigo-950 border border-indigo-700 text-indigo-300 hover:bg-indigo-900'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          ↪ Review & Forward
          {totalSelected > 0 && (
            <span className="bg-indigo-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
              {totalSelected}
            </span>
          )}
        </button>

        {/* Save Version */}
        <button
          onClick={openSaveModal}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
            saveStatus === 'saved'
              ? 'bg-green-950 border border-green-900 text-green-400'
              : saveStatus === 'error'
              ? 'bg-red-950 border border-red-900 text-red-400'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {saveLabel[saveStatus]}
        </button>

        {/* Checkpoints */}
        <button
          onClick={() => { setShowCheckpoints(v => !v); setShowForward(false) }}
          className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          🕐 Checkpoints
          {checkpoints.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {checkpoints.length}
            </span>
          )}
        </button>

        {/* Session Backup */}
        <button
          onClick={handleBackup}
          className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          ⬇ Session Backup
        </button>

        {/* Create Handoff Package */}
        <button
          onClick={() => setShowHandoffModal(true)}
          className="flex items-center gap-1.5 bg-gray-800 border border-purple-900 hover:bg-purple-950 hover:border-purple-700 text-purple-400 hover:text-purple-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          ↗ Create Handoff Package
        </button>

        {/* Indicador de estado */}
        <span className={`ml-auto text-xs px-2.5 py-1 rounded-full border ${
          locked
            ? 'text-red-400 bg-red-950 border-red-900'
            : 'text-green-400 bg-green-950 border-green-900'
        }`}>
          {locked ? 'workspace bloqueado' : 'workspace activo'}
        </span>
      </div>

      {/* ── Modal de Handoff Package ── */}
      {showHandoffModal && (
        <HandoffPackageModal
          workspace={workspace}
          getAgentMessages={getAgentMessages}
          onClose={() => setShowHandoffModal(false)}
          onCreated={() => setShowHandoffModal(false)}
        />
      )}

      {/* ── Modal de Save Version ── */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeSaveModal() }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-5">
            <h2 className="text-base font-semibold text-white">Guardar checkpoint</h2>

            {/* Nombre — obligatorio */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Nombre del checkpoint <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={e => {
                  setSaveName(e.target.value)
                  if (e.target.value.trim()) setNameError(false)
                }}
                onKeyDown={e => { if (e.key === 'Enter') confirmSave() }}
                placeholder="Ej: Análisis inicial v1"
                className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors ${
                  nameError
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-indigo-500'
                }`}
              />
              {nameError && (
                <p className="text-xs text-red-400">El nombre es obligatorio</p>
              )}
            </div>

            {/* Propósito */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Propósito</label>
              <select
                value={savePurpose}
                onChange={e => setSavePurpose(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              >
                {PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Error de API */}
            {saveModalError && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                {saveModalError}
              </p>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={confirmSave}
                disabled={saveStatus === 'saving'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {saveStatus === 'saving' ? 'Guardando…' : 'Guardar checkpoint'}
              </button>
              <button
                onClick={closeSaveModal}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
