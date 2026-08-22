'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AgentPanel, { type AgentPanelHandle } from './AgentPanel'
import HandoffPackageModal from './HandoffPackageModal'
import HumanChatPanel, { type HumanChatPanelHandle } from './HumanChatPanel'
import type { LoadToChatProvenance } from './LoadContextModal'
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


// Referencias estables a nivel módulo — evitan crear arrays nuevos por render
// (un `?? []` inline rompe la comparación shallow de React.memo en los paneles)
const EMPTY_MESSAGES: Message[] = []
const EMPTY_HUMAN_MESSAGES: HumanMessage[] = []
const HUMAN_FORWARD_TARGETS = [{ role: 'manager', label: 'Manager' }]

interface ConnectionContext {
  connectionId:   string
  isHost:         boolean
  otherUserEmail: string
  otherUserName?: string
  status:         string
}

interface PanelSnapshot {
  role:         string
  panel:        string
  lastMessages: { role: 'user' | 'assistant'; content: string }[]
}

// Callbacks y arrays por sesión con identidad estable (ver panelBindings)
interface PanelBinding {
  setRef:                 (el: AgentPanelHandle | null) => void
  onSelectionChange:      (count: number) => void
  onForward:              (messages: ChatMessage[], targetRole: string) => void
  onCreateHandoff:        () => void
  getOtherPanelsSnapshot: () => PanelSnapshot[]
  forwardTargets:         { role: string; label: string }[]
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

export default function WorkspaceShell({ workspace, initialMessages, initialCheckpointId, prefillMessage, connectionContext, initialHumanMessages = EMPTY_HUMAN_MESSAGES, currentUserId = '' }: Props) {
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
  const [saveSelectionError, setSaveSelectionError]             = useState<string | null>(null)
  const [exportingFormat, setExportingFormat]                   = useState<'excel' | 'word' | null>(null)

  // User Library (2026-08-21) — "Add to User Library" dentro del modal de Save
  // Selection. availableTags se carga lazy (solo la primera vez que se tilda
  // el checkbox), no en cada apertura del modal.
  const [addToLibrary, setAddToLibrary]           = useState(false)
  const [availableTags, setAvailableTags]         = useState<{ id: string; name: string }[]>([])
  const [tagsLoaded, setTagsLoaded]               = useState(false)
  const [selectedTagIds, setSelectedTagIds]       = useState<string[]>([])
  const [showNewTagInput, setShowNewTagInput]     = useState(false)
  const [newTagName, setNewTagName]               = useState('')
  const [creatingTag, setCreatingTag]             = useState(false)

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
  const handleSelectionChange = useCallback((sessionId: string, count: number) => {
    selectionCounts.current[sessionId] = count
    // Exclude 'human-chat' from total for global bar (human chat has its own controls)
    const total = Object.entries(selectionCounts.current)
      .filter(([id]) => id !== 'human-chat')
      .reduce((sum, [, count]) => sum + count, 0)
    setTotalSelected(total)
  }, [])

  const handleHumanSelectionChange = useCallback(
    (count: number) => handleSelectionChange('human-chat', count),
    [handleSelectionChange]
  )

  function _clearAllSelections() {
    for (const session of workspace.agent_sessions) {
      panelRefs.current[session.id]?.clearSelection()
    }
    // Note: human chat has its own clear selection, not included here
  }

  // ── Panel-level Review & Forward ─────────────────────────────────────────
  const handlePanelForward = useCallback(async (fromSession: AgentSession, messages: ChatMessage[], targetRole: string) => {
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
            workspaceId: workspace.id,
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

    // Auditar ANTES de reenviar — el id del evento se pasa como provenance
    // del mensaje reenviado (message_provenance, migración 055). Fail-open:
    // si el insert falla o tarda, igual se reenvía, sin provenance.
    let provenance: LoadToChatProvenance | undefined
    try {
      const auditRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          event_type:   'review_forward',
          metadata:     { from: fromSession.agent_role, to: targetRole },
        }),
      })
      if (auditRes.ok) {
        const auditData = await auditRes.json() as { id?: string }
        if (auditData.id) {
          provenance = { source_object_type: 'review_forward', source_object_id: auditData.id }
        }
      }
    } catch (err) {
      console.error('[WorkspaceShell] review_forward audit insert failed:', err)
    }

    targetRef.appendUserMessage(`[Forwarded from ${label}]\n\n${forwarded}`, provenance)
    panelRefs.current[fromSession.id]?.clearSelection()
  }, [connectionContext, workspace.agent_sessions, workspace.id])

  // ── Human chat Review & Forward ──────────────────────────────────────────
  const handleHumanForward = useCallback(async (messages: HumanMessage[], targetRole: string) => {
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

    // Auditar ANTES de reenviar — mismo mecanismo que handlePanelForward
    // (ver comentario ahí). Fail-open: si falla, se reenvía sin provenance.
    let provenance: LoadToChatProvenance | undefined
    try {
      const auditRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          event_type:  'review_forward',
          metadata:    {
            from:          'human_chat',
            to:            targetRole,
            message_count: messages.length,
            connection_id: connectionContext?.connectionId ?? null,
            partner_email: connectionContext?.otherUserEmail ?? null,
          },
        }),
      })
      if (auditRes.ok) {
        const auditData = await auditRes.json() as { id?: string }
        if (auditData.id) {
          provenance = { source_object_type: 'review_forward', source_object_id: auditData.id }
        }
      }
    } catch (err) {
      console.error('[WorkspaceShell] review_forward audit insert failed:', err)
    }

    targetRef.appendUserMessage(`[Forwarded from Human Chat]\n\n${forwarded}`, provenance)
    humanChatRef.current?.clearSelection()
  }, [workspace.agent_sessions, workspace.id, currentUserId, connectionContext])

  // ── Save Version → abre modal con nombre y propósito ─────────────────────
  const openSaveModal = useCallback(() => {
    setSaveName('')
    setSavePurpose(PURPOSES[0])
    setNameError(false)
    setSaveModalError(null)
    setShowSaveModal(true)
  }, [])

  function closeSaveModal() {
    setShowSaveModal(false)
    setNameError(false)
    setSaveModalError(null)
  }

  // ── Save Selection ────────────────────────────────────────────────────────
  const openSaveSelectionModal = useCallback(() => {
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
    setSaveSelectionError(null)
    setAddToLibrary(false)
    setSelectedTagIds([])
    setShowNewTagInput(false)
    setNewTagName('')
    setShowSaveSelectionModal(true)
  }, [workspace.agent_sessions, isConnectedWorkspace, connectionContext, currentUserId])

  // User Library — carga lazy de tags existentes, solo la primera vez que se
  // tilda "Add to User Library" en esta sesión de la página.
  const loadAvailableTags = useCallback(async () => {
    if (tagsLoaded) return
    try {
      const res = await fetch('/api/tags')
      if (res.ok) setAvailableTags(await res.json())
    } catch {
      // Fail-open: el checkbox sigue usable, la lista de tags queda vacía
      // (el usuario puede crear uno nuevo igual).
    } finally {
      setTagsLoaded(true)
    }
  }, [tagsLoaded])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])
  }

  const createTag = async () => {
    const name = newTagName.trim()
    if (!name || creatingTag) return
    setCreatingTag(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setSaveSelectionError(body?.error ?? 'Failed to create tag.')
        return
      }
      const tag = await res.json() as { id: string; name: string }
      setAvailableTags(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedTagIds(prev => prev.includes(tag.id) ? prev : [...prev, tag.id])
      setNewTagName('')
      setShowNewTagInput(false)
    } catch {
      setSaveSelectionError('Network error — could not create tag, try again.')
    } finally {
      setCreatingTag(false)
    }
  }

  const handleSaveSelection = async () => {
    if (!saveSelectionName.trim() || pendingSelectionMessages.length === 0) return
    if (addToLibrary && selectedTagIds.length === 0) {
      setSaveSelectionError('Select at least one tag, or create a new one, to add this to User Library.')
      return
    }
    setSavingSelection(true)
    setSaveSelectionError(null)
    try {
      const res = await fetch('/api/save-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          team_id:      workspace.team_id ?? null,
          project_id:   null,
          name:         saveSelectionName.trim(),
          messages:     pendingSelectionMessages,
          tagIds:       addToLibrary ? selectedTagIds : [],
        }),
      })

      if (!res.ok) {
        // Guardado fallido: mantener modal abierto y la selección intacta
        const body = await res.json().catch(() => null)
        setSaveSelectionError(body?.error ?? `Failed to save selection (${res.status})`)
        return
      }

      finishSelectionAction()
    } catch {
      setSaveSelectionError('Network error — your selection was kept, try again.')
    } finally {
      setSavingSelection(false)
    }
  }

  // Cierre + limpieza compartidos por Save Selection y los exports (Excel/Word).
  // Solo se invoca en el camino de éxito confirmado — un fallo mantiene el
  // modal abierto y la selección intacta.
  const finishSelectionAction = () => {
    setShowSaveSelectionModal(false)
    setSaveSelectionName('')
    setPendingSelectionMessages([])
    setAddToLibrary(false)
    setSelectedTagIds([])
    setShowNewTagInput(false)
    setNewTagName('')
    // Mismo patrón que Review & Forward y Create Handoff Package. Sin esto,
    // la selección anterior queda "oculta" pero activa y se cuela en la
    // próxima acción de selección.
    for (const session of workspace.agent_sessions) {
      panelRefs.current[session.id]?.clearSelection()
    }
    humanChatRef.current?.clearSelection()
  }

  // ── Export selection as Excel / Word ─────────────────────────────────────
  // No guarda en DB. Al completarse la descarga, cierra el modal y limpia la
  // selección (mismo comportamiento que Save Selection); un fallo mantiene
  // el modal abierto con error y la selección intacta.
  const handleExportSelection = async (format: 'excel' | 'word') => {
    if (pendingSelectionMessages.length === 0 || exportingFormat) return
    setExportingFormat(format)
    setSaveSelectionError(null)
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     saveSelectionName.trim() || undefined,
          messages: pendingSelectionMessages,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setSaveSelectionError(body?.error ?? `Export failed (${res.status})`)
        return
      }

      // Descarga estándar del navegador: blob + link temporal
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const fallbackExt = format === 'excel' ? 'xlsx' : 'docx'
      const filename = filenameMatch?.[1] ?? `selection.${fallbackExt}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // El archivo ya llegó completo (res.blob() resolvió) y la descarga fue
      // disparada — recién ahora cerrar y limpiar, igual que Save Selection.
      finishSelectionAction()
    } catch {
      setSaveSelectionError('Network error — export failed, try again.')
    } finally {
      setExportingFormat(null)
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

  // ── Bindings estables por sesión ──────────────────────────────────────────
  // Callbacks y arrays con identidad estable entre renders: requisito para que
  // React.memo en AgentPanel pueda saltear re-renders cuando cambia el estado
  // de un panel hermano (tipeo, streaming, selección) o del shell (modales).
  const panelBindings = useMemo(() => {
    const map: Record<string, PanelBinding> = {}
    for (const session of workspace.agent_sessions) {
      const isIsolatedManagerConnected =
        isConnectedWorkspace &&
        session.agent_role === 'manager' &&
        workspace.teams?.type === 'isolated'

      if (isIsolatedManagerConnected && !connectionContext) {
        console.warn('[WorkspaceShell] Missing connectionContext/otherUserEmail for isolated forward target')
      }

      const forwardTargets = isIsolatedManagerConnected
        ? (connectionContext
            ? [{ role: 'human_chat', label: connectionContext.otherUserEmail }]
            : []) // No targets available in anomalous case
        : workspace.agent_sessions
            .filter(s => s.id !== session.id)
            .map(s => ({ role: s.agent_role, label: AGENT_LABEL[s.agent_role] ?? s.agent_role }))

      map[session.id] = {
        setRef:                 el => { panelRefs.current[session.id] = el },
        onSelectionChange:      count => handleSelectionChange(session.id, count),
        onForward:              (messages, targetRole) => handlePanelForward(session, messages, targetRole),
        onCreateHandoff:        () => setShowHandoffModal(true),
        getOtherPanelsSnapshot: () => buildOtherPanelsSnapshot(session.id),
        forwardTargets,
      }
    }
    return map
  }, [workspace.agent_sessions, workspace.teams?.type, isConnectedWorkspace, connectionContext, handleSelectionChange, handlePanelForward, buildOtherPanelsSnapshot])

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
              onSelectionChange={handleHumanSelectionChange}
              onSaveVersion={openSaveModal}
              onOpenSaveSelection={openSaveSelectionModal}
              forwardTargets={HUMAN_FORWARD_TARGETS}
              onForward={handleHumanForward}
              workspaceLocked={locked}
              connectionStatus={connectionContext.status}
            />

            {/* Manager Panel (identified by agent_role) */}
            {managerSession && (
              <AgentPanel
                key={managerSession.id}
                ref={panelBindings[managerSession.id].setRef}
                session={managerSession}
                initialMessages={initialMessages[managerSession.id] ?? EMPTY_MESSAGES}
                workspaceLocked={locked}
                onSelectionChange={panelBindings[managerSession.id].onSelectionChange}
                forwardTargets={panelBindings[managerSession.id].forwardTargets}
                onForward={panelBindings[managerSession.id].onForward}
                onCreateHandoff={panelBindings[managerSession.id].onCreateHandoff}
                onSaveVersion={openSaveModal}
                onOpenSaveSelection={openSaveSelectionModal}
                teamId={workspace.team_id}
                projectId={workspace.teams?.project_id ?? undefined}
                teamType={teamType}
                getOtherPanelsSnapshot={panelBindings[managerSession.id].getOtherPanelsSnapshot}
                initialInput={prefillMessage}
              />
            )}
          </>
        ) : (
          workspace.agent_sessions.map(session => (
            <AgentPanel
              key={session.id}
              ref={panelBindings[session.id].setRef}
              session={session}
              initialMessages={initialMessages[session.id] ?? EMPTY_MESSAGES}
              workspaceLocked={locked}
              onSelectionChange={panelBindings[session.id].onSelectionChange}
              forwardTargets={panelBindings[session.id].forwardTargets}
              onForward={panelBindings[session.id].onForward}
              onCreateHandoff={panelBindings[session.id].onCreateHandoff}
              onSaveVersion={openSaveModal}
              onOpenSaveSelection={openSaveSelectionModal}
              teamId={workspace.team_id}
              projectId={workspace.teams?.project_id ?? undefined}
              teamType={teamType}
              getOtherPanelsSnapshot={panelBindings[session.id].getOtherPanelsSnapshot}
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

            {/* User Library (2026-08-21) — tags manuales, opcional. Toggle
                estilo card en vez de checkbox chico: pedido explícito de más
                peso visual, ver ajuste de UX 2026-08-21. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const next = !addToLibrary
                  setAddToLibrary(next)
                  if (next) loadAvailableTags()
                }}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  addToLibrary
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    addToLibrary ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-gray-300 bg-white'
                  }`}
                >
                  {addToLibrary && <span className="text-sm font-bold leading-none text-white">✓</span>}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                    📚 Add to User Library
                  </span>
                  <span className="block text-xs text-gray-500">
                    Tag this selection so you can find it again by topic.
                  </span>
                </span>
              </button>
              {addToLibrary && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-xs text-gray-500">
                    Tags <span className="text-red-400">*</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.length === 0 && !showNewTagInput && (
                      <p className="text-xs text-gray-400">No tags yet — create your first one.</p>
                    )}
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                  {showNewTagInput ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createTag() }}
                        placeholder="New tag name..."
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)]"
                      />
                      <button
                        type="button"
                        onClick={createTag}
                        disabled={!newTagName.trim() || creatingTag}
                        className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {creatingTag ? '…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewTagInput(false); setNewTagName('') }}
                        className="px-2 text-xs text-gray-500 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewTagInput(true)}
                      className="text-xs font-medium text-[var(--color-accent)] hover:opacity-75"
                    >
                      + Create new tag
                    </button>
                  )}
                </div>
              )}
            </div>

            {saveSelectionError && (
              <p className="text-xs bg-[var(--color-error-bg,#fee2e2)] border border-[var(--color-error-border,#fca5a5)] text-[var(--color-error-text,#991b1b)] rounded-lg px-3 py-2">
                {saveSelectionError}
              </p>
            )}

            {/* Export to file — no guarda en el repositorio, solo descarga */}
            <div className="flex gap-3">
              <button
                onClick={() => handleExportSelection('excel')}
                disabled={savingSelection || exportingFormat !== null}
                className="flex-1 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'excel' ? 'Generating…' : 'Save as Excel'}
              </button>
              <button
                onClick={() => handleExportSelection('word')}
                disabled={savingSelection || exportingFormat !== null}
                className="flex-1 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'word' ? 'Generating…' : 'Save as Word'}
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSaveSelection}
                disabled={!saveSelectionName.trim() || savingSelection || exportingFormat !== null || (addToLibrary && selectedTagIds.length === 0)}
                className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {savingSelection ? 'Saving...' : 'Save Selection(s)'}
              </button>
              <button
                onClick={() => setShowSaveSelectionModal(false)}
                disabled={savingSelection || exportingFormat !== null}
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
