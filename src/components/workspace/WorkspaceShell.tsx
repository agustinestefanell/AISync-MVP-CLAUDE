'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AgentPanel, { type AgentPanelHandle } from './AgentPanel'
import HandoffPackageModal from './HandoffPackageModal'
import type { AgentSession, Checkpoint, WorkspaceWithAgents, Message } from '@/lib/db/types'
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


interface Props {
  workspace: WorkspaceWithAgents
  initialMessages: Record<string, Message[]>
  initialCheckpointId?: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function WorkspaceShell({ workspace, initialMessages, initialCheckpointId }: Props) {
  const [lockState, setLockState]       = useState(workspace.lock_state)
  const [_lockLoading, setLockLoading]  = useState(false)
  const [_checkpoints, setCheckpoints]  = useState<Checkpoint[]>([])
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>('idle')
  const [_resumingId, setResumingId]    = useState<string | null>(null)
  const [_totalSelected, setTotalSelected]        = useState(0)
  const [showHandoffModal, setShowHandoffModal]   = useState(false)

  // Modal de Save Version
  const [showSaveModal, setShowSaveModal]   = useState(false)
  const [saveName, setSaveName]             = useState('')
  const [savePurpose, setSavePurpose]       = useState<string>(PURPOSES[0])
  const [nameError, setNameError]           = useState(false)
  const [saveModalError, setSaveModalError] = useState<string | null>(null)

  // Modal de Save Selection
  const [showSaveSelectionModal, setShowSaveSelectionModal]     = useState(false)
  const [saveSelectionName, setSaveSelectionName]               = useState('')
  const [pendingSelectionMessages, setPendingSelectionMessages] = useState<ChatMessage[]>([])
  const [savingSelection, setSavingSelection]                   = useState(false)

  const panelRefs       = useRef<Record<string, AgentPanelHandle | null>>({})
  const selectionCounts = useRef<Record<string, number>>({})

  // SAT vs MAT: one provider = SAT, many = MAT (same logic as teams/route.ts)
  const teamType = useMemo(() => {
    const providers = new Set(workspace.agent_sessions.map(s => s.provider))
    return providers.size === 1 ? ('SAT' as const) : ('MAT' as const)
  }, [workspace.agent_sessions])

  // Snapshot of last N messages from all panels except the calling one
  const buildOtherPanelsSnapshot = useCallback((currentSessionId: string) => {
    return workspace.agent_sessions
      .filter(s => s.id !== currentSessionId)
      .map(s => {
        const allMsgs = panelRefs.current[s.id]?.getAllMessages() ?? []
        const lastMessages = allMsgs
          .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
          .slice(-5)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        return {
          role:  AGENT_LABEL[s.agent_role] ?? s.agent_role,
          panel: s.agent_role,
          lastMessages,
        }
      })
      .filter(p => p.lastMessages.length > 0)
  }, [workspace.agent_sessions])

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
  async function _handleLockToggle() {
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

  function _clearAllSelections() {
    for (const session of workspace.agent_sessions) {
      panelRefs.current[session.id]?.clearSelection()
    }
  }

  // ── Panel-level Review & Forward ─────────────────────────────────────────
  function handlePanelForward(fromSession: AgentSession, messages: ChatMessage[], targetRole: string) {
    const targetSession = workspace.agent_sessions.find(s => s.agent_role === targetRole)
    if (!targetSession) return
    const targetRef = panelRefs.current[targetSession.id]
    if (!targetRef) return

    const label     = AGENT_LABEL[fromSession.agent_role] ?? fromSession.agent_role
    const forwarded = messages
      .map(m => `${m.role === 'user' ? 'User' : label}: ${m.content}`)
      .join('\n\n')

    targetRef.appendUserMessage(`[Forwarded from ${label}]\n\n${forwarded}`)
    panelRefs.current[fromSession.id]?.clearSelection()

    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        event_type:  'review_forward',
        metadata:    {
          from_agent:    fromSession.agent_role,
          to_agent:      targetRole,
          message_count: messages.length,
        },
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

  // ── Save Selection ────────────────────────────────────────────────────────
  const openSaveSelectionModal = () => {
    const allMessages: ChatMessage[] = []
    Object.values(panelRefs.current).forEach(ref => {
      const msgs = ref?.getSelectedMessages?.() ?? []
      allMessages.push(...msgs)
    })
    if (allMessages.length === 0) return
    setPendingSelectionMessages(allMessages)
    setSaveSelectionName('')
    setShowSaveSelectionModal(true)
  }

  const handleSaveSelection = async () => {
    if (!saveSelectionName.trim() || pendingSelectionMessages.length === 0) return
    setSavingSelection(true)
    try {
      await fetch('/api/save-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          team_id:      workspace.team_id ?? null,
          project_id:   null,
          name:         saveSelectionName.trim(),
          messages:     pendingSelectionMessages,
        }),
      })
      setShowSaveSelectionModal(false)
      setSaveSelectionName('')
      setPendingSelectionMessages([])
    } finally {
      setSavingSelection(false)
    }
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
  async function _handleBackup() {
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

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-4" style={{ background: 'var(--color-app-bg)' }}>

      {/* Agent panels */}
      <div
        className="flex-1 grid min-h-0 overflow-hidden gap-4"
        style={{ gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' }}
      >
        {workspace.agent_sessions.map(session => (
          <AgentPanel
            key={session.id}
            ref={el => { panelRefs.current[session.id] = el }}
            session={session}
            initialMessages={initialMessages[session.id] ?? []}
            workspaceLocked={locked}
            onSelectionChange={count => handleSelectionChange(session.id, count)}
            forwardTargets={workspace.agent_sessions
              .filter(s => s.id !== session.id)
              .map(s => ({ role: s.agent_role, label: AGENT_LABEL[s.agent_role] ?? s.agent_role }))
            }
            onForward={(messages, targetRole) => handlePanelForward(session, messages, targetRole)}
            onCreateHandoff={() => setShowHandoffModal(true)}
            onSaveVersion={openSaveModal}
            teamId={workspace.team_id}
            teamType={teamType}
            getOtherPanelsSnapshot={() => buildOtherPanelsSnapshot(session.id)}
          />
        ))}
      </div>

      {/* ── Save Selection bar ── */}
      {_totalSelected > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-white">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {_totalSelected} message{_totalSelected !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={openSaveSelectionModal}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Save Selection(s)
          </button>
        </div>
      )}

      {/* ── Modal de Save Selection ── */}
      {showSaveSelectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSaveSelectionModal(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-5">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Save Selection</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {pendingSelectionMessages.length} message{pendingSelectionMessages.length !== 1 ? 's' : ''} selected
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">
                Selection name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={saveSelectionName}
                onChange={e => setSaveSelectionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSelection() }}
                placeholder="Selection name..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none transition-colors focus:border-[var(--color-border-focus)]"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSaveSelection}
                disabled={!saveSelectionName.trim() || savingSelection}
                className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {savingSelection ? 'Saving...' : 'Save Selection(s)'}
              </button>
              <button
                onClick={() => setShowSaveSelectionModal(false)}
                disabled={savingSelection}
                className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-5">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Guardar checkpoint</h2>

            {/* Nombre — obligatorio */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">
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
                className={`w-full bg-gray-50 border rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none transition-colors ${
                  nameError
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-200 focus:border-[var(--color-border-focus)]'
                }`}
              />
              {nameError && (
                <p className="text-xs text-red-400">El nombre es obligatorio</p>
              )}
            </div>

            {/* Propósito */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Propósito</label>
              <select
                value={savePurpose}
                onChange={e => setSavePurpose(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] transition-colors"
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
                className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {saveStatus === 'saving' ? 'Guardando…' : 'Guardar checkpoint'}
              </button>
              <button
                onClick={closeSaveModal}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm rounded-lg transition-colors disabled:opacity-50"
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
