'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AgentPanel, { type AgentPanelHandle } from './AgentPanel'
import HandoffPackageModal from './HandoffPackageModal'
import HumanChatPanel, { type HumanChatPanelHandle } from './HumanChatPanel'
import type { AgentSession, Checkpoint, WorkspaceWithAgents, Message, HumanMessage } from '@/lib/db/types'
import type { ChatMessage } from '@/lib/providers/types'

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

const PURPOSES = [
  'Checkpoint',
  'Evidence',
  'Reuse',
  'Handoff',
  'Resume Later',
  'Documentation',
  'Audit Support',
] as const


interface ConnectionContext {
  connectionId:   string
  isHost:         boolean
  otherUserEmail: string
  otherUserName?: string
  status:         string
}

interface Props {
  workspace: WorkspaceWithAgents
  initialMessages: Record<string, Message[]>
  initialCheckpointId?: string
  prefillMessage?: string
  connectionContext?: ConnectionContext
  initialHumanMessages?: HumanMessage[]
  currentUserId?: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function WorkspaceShell({ workspace, initialMessages, initialCheckpointId, prefillMessage, connectionContext, initialHumanMessages = [], currentUserId = '' }: Props) {
  const isConnectedWorkspace = !!connectionContext
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
  const humanChatRef    = useRef<HumanChatPanelHandle | null>(null)
  const selectionCounts = useRef<Record<string, number>>({})

  // Identify Manager by explicit agent_role (not by position)
  const managerSession = useMemo(() => {
    const manager = workspace.agent_sessions.find(s => s.agent_role === 'manager')
    if (!manager) {
      console.warn('[WorkspaceShell] Manager session not found for workspace', workspace.id)
    }
    return manager
  }, [workspace.agent_sessions, workspace.id])

  // Read team.type from persisted data (single source of truth)
  const teamType = useMemo(() => {
    if (!workspace.teams?.type) {
      console.warn('[WorkspaceShell] Missing team.type for workspace', workspace.id)
      return null
    }
    return workspace.teams.type === 'isolated' ? ('SAT' as const) : workspace.teams.type
  }, [workspace.teams?.type, workspace.id])

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
    // Exclude 'human-chat' from total for global bar (human chat has its own controls)
    const total = Object.entries(selectionCounts.current)
      .filter(([id]) => id !== 'human-chat')
      .reduce((sum, [, count]) => sum + count, 0)
    setTotalSelected(total)
  }

  function _clearAllSelections() {
    for (const session of workspace.agent_sessions) {
      panelRefs.current[session.id]?.clearSelection()
    }
    // Note: human chat has its own clear selection, not included here
  }

  // ── Panel-level Review & Forward ─────────────────────────────────────────
  async function handlePanelForward(fromSession: AgentSession, messages: ChatMessage[], targetRole: string) {
    // Special case: forward to human chat in isolated teams
    if (targetRole === 'human_chat' && connectionContext) {
      const label = AGENT_LABEL[fromSession.agent_role] ?? fromSession.agent_role
      const forwarded = messages
        .map(m => `${m.role === 'user' ? 'User' : label}: ${m.content}`)
        .join('\n\n')

      const content = `[Forwarded from ${label}]\n\n${forwarded}`

      try {
        const res = await fetch('/api/human-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: connectionContext.connectionId,
            content,
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          console.error('[WorkspaceShell] Forward to human failed:', error)
          return
        }

        // The sender does not receive its own Realtime event because the human chat
        // subscription uses broadcast self: false, so we append the inserted message locally
        const newMessage = await res.json() as HumanMessage
        humanChatRef.current?.appendMessage(newMessage)

        panelRefs.current[fromSession.id]?.clearSelection()

        // Audit log
        fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspace.id,
            event_type: 'review_forward',
            metadata: {
              from: fromSession.agent_role,
              to: 'human_chat',
              target_type: 'human_chat',
              target_email: connectionContext.otherUserEmail,
              connection_id: connectionContext.connectionId,
              message_count: messages.length,
            },
          }),
        }).catch(console.error)
      } catch (err) {
        console.error('[WorkspaceShell] Forward to human failed:', err)
      }

      return
    }

    // Normal case: forward to another agent session
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
        workspace_id: workspace.id,
        event_type:   'review_forward',
        metadata:     { from: fromSession.agent_role, to: targetRole },
      }),
    }).catch(console.error)
  }

  // ── Human chat Review & Forward ──────────────────────────────────────────
  function handleHumanForward(messages: HumanMessage[], targetRole: string) {
    const targetSession = workspace.agent_sessions.find(s => s.agent_role === targetRole)
    if (!targetSession) return
    const targetRef = panelRefs.current[targetSession.id]
    if (!targetRef) return

    const forwarded = messages
      .map(m => {
        const isFromMe = m.from_account_id === currentUserId
        const sender = isFromMe ? 'You' : (connectionContext?.otherUserName || connectionContext?.otherUserEmail || 'Other user')
        return `${sender}: ${m.content}`
      })
      .join('\n\n')

    targetRef.appendUserMessage(`[Forwarded from Human Chat]\n\n${forwarded}`)
    humanChatRef.current?.clearSelection()

    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspace.id,
        event_type:  'review_forward',
        metadata:    {
          from:          'human_chat',
          to:            targetRole,
          message_count: messages.length,
        },
      }),
    }).catch(console.error)
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

    // Collect selected messages from agent panels only
    // (human chat has its own Save Selection button and doesn't use global modal)
    Object.entries(panelRefs.current).forEach(([sessionId, ref]) => {
      const msgs = ref?.getSelectedMessages?.() ?? []
      const session = workspace.agent_sessions?.find(s => s.id === sessionId)
      const agentRole = session?.agent_role ?? undefined
      allMessages.push(...msgs.map(m => ({ ...m, agent_role: agentRole })))
    })

    // Note: We intentionally DO NOT collect human messages here when called from global bar
    // Human chat Save Selection is handled by its own button inside HumanChatPanel
    // Only collect human messages if explicitly called from HumanChatPanel's own button
    const calledFromHumanChat = isConnectedWorkspace && (humanChatRef.current?.getSelectedMessages().length ?? 0) > 0
    if (calledFromHumanChat && connectionContext && humanChatRef.current) {
      const humanSelected = humanChatRef.current.getSelectedMessages()
      // Convert HumanMessage to ChatMessage format with metadata
      humanSelected.forEach(hm => {
        const isFromMe = hm.from_account_id === currentUserId
        allMessages.push({
          role: 'user',
          content: hm.content,
          created_at: hm.created_at,
          _isHumanMessage: true,
          _humanMessageId: hm.id,
          _fromAccountId: hm.from_account_id,
          _toAccountId: hm.to_account_id,
          _connectionId: hm.connection_id,
          _displayLabel: isFromMe ? 'You' : (connectionContext.otherUserName || connectionContext.otherUserEmail),
        } as ChatMessage)
      })
    }

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

    // Collect human messages if this is a Connected Workspace
    const humanMessages: HumanMessage[] = (isConnectedWorkspace && humanChatRef.current)
      ? humanChatRef.current.getAllMessages()
      : []

    const totalMessages = panels.reduce((n, p) => n + p.messages.length, 0) + humanMessages.length
    if (totalMessages === 0) {
      setSaveModalError('No messages to save in this checkpoint.')
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
          humanMessages,
          connectionId: connectionContext?.connectionId,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[WorkspaceShell confirmSave] Checkpoint save failed:', res.status, errText)
        throw new Error(`Failed to save checkpoint (${res.status})`)
      }

      const { checkpoint, error } = await res.json()
      if (error) throw new Error(error)

      setCheckpoints(prev => [checkpoint, ...prev])
      setSaveStatus('saved')
      closeSaveModal()
    } catch (err) {
      setSaveModalError(err instanceof Error ? err.message : 'Error saving')
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
        style={{
          gridTemplateColumns: isConnectedWorkspace ? '1fr 1fr' : '1fr 1fr 1fr',
          gridTemplateRows: '1fr'
        }}
      >
        {isConnectedWorkspace && connectionContext ? (
          <>
            {/* Human Chat Panel */}
            <HumanChatPanel
              ref={humanChatRef}
              connectionId={connectionContext.connectionId}
              currentUserId={currentUserId}
              otherUserEmail={connectionContext.otherUserEmail}
              otherUserName={connectionContext.otherUserName}
              initialMessages={initialHumanMessages}
              onSelectionChange={count => handleSelectionChange('human-chat', count)}
              onSaveVersion={openSaveModal}
              onOpenSaveSelection={openSaveSelectionModal}
              forwardTargets={[{ role: 'manager', label: 'Manager' }]}
              onForward={handleHumanForward}
              workspaceLocked={locked}
              connectionStatus={connectionContext.status}
            />

            {/* Manager Panel (identified by agent_role) */}
            {managerSession && (
              <AgentPanel
                key={managerSession.id}
                ref={el => { panelRefs.current[managerSession.id] = el }}
                session={managerSession}
                initialMessages={initialMessages[managerSession.id] ?? []}
                workspaceLocked={locked}
                onSelectionChange={count => handleSelectionChange(managerSession.id, count)}
                forwardTargets={
                  // In isolated teams, Manager can only forward to the connected human user
                  workspace.teams?.type === 'isolated'
                    ? connectionContext
                      ? [{ role: 'human_chat', label: connectionContext.otherUserEmail }]
                      : (() => {
                          console.warn('[WorkspaceShell] Missing connectionContext/otherUserEmail for isolated forward target')
                          return [] // No targets available in anomalous case
                        })()
                    : workspace.agent_sessions
                        .filter(s => s.id !== managerSession.id)
                        .map(s => ({ role: s.agent_role, label: AGENT_LABEL[s.agent_role] ?? s.agent_role }))
                }
                onForward={(messages, targetRole) => handlePanelForward(managerSession, messages, targetRole)}
                onCreateHandoff={() => setShowHandoffModal(true)}
                onSaveVersion={openSaveModal}
                onOpenSaveSelection={openSaveSelectionModal}
                teamId={workspace.team_id}
                projectId={workspace.teams?.project_id ?? undefined}
                teamType={teamType}
                getOtherPanelsSnapshot={() => buildOtherPanelsSnapshot(managerSession.id)}
                initialInput={prefillMessage}
              />
            )}
          </>
        ) : (
          workspace.agent_sessions.map(session => (
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
              onOpenSaveSelection={openSaveSelectionModal}
              teamId={workspace.team_id}
              projectId={workspace.teams?.project_id ?? undefined}
              teamType={teamType}
              getOtherPanelsSnapshot={() => buildOtherPanelsSnapshot(session.id)}
              initialInput={session.agent_role === 'manager' ? prefillMessage : undefined}
            />
          ))
        )}
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
            {_totalSelected === 1 ? 'Save Selection (1)' : `Save Selections (${_totalSelected})`}
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
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Save Version</h2>

            {/* Name — required */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">
                Checkpoint name <span className="text-red-400">*</span>
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
                placeholder="e.g. Initial analysis v1"
                className={`w-full bg-gray-50 border rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none transition-colors ${
                  nameError
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-200 focus:border-[var(--color-border-focus)]'
                }`}
              />
              {nameError && (
                <p className="text-xs text-red-400">Name is required</p>
              )}
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Purpose</label>
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

            {/* API error */}
            {saveModalError && (
              <p className="text-xs bg-[var(--color-error-bg,#fee2e2)] border border-[var(--color-error-border,#fca5a5)] text-[var(--color-error-text,#991b1b)] rounded-lg px-3 py-2">
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
                {saveStatus === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={closeSaveModal}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
