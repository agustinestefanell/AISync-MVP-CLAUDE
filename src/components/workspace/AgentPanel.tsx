'use client'

import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Copy, Check, FileText, Image as ImageIcon } from 'lucide-react'
import type { AgentSession, Message } from '@/lib/db/types'
import type { ChatMessage, ChatAttachment } from '@/lib/providers/types'
import PromptLibrary from './PromptLibrary'
import ContextFilePanel from './ContextFilePanel'

// ── Role configuration ───────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  displayLabel: string
  panelClass:   string
  headerClass:  string
  accentColor:  string
  accentSoft:   string
}> = {
  manager: {
    displayLabel: 'AI General Manager',
    panelClass:   'ui-role-panel-manager ui-manager-panel',
    headerClass:  'ui-manager-header',
    accentColor:  'var(--color-role-manager-accent)',
    accentSoft:   'var(--color-role-manager-soft)',
  },
  worker1: {
    displayLabel: 'Worker 1',
    panelClass:   'ui-role-panel-worker1',
    headerClass:  'ui-worker-header',
    accentColor:  'var(--color-role-worker1-accent)',
    accentSoft:   'var(--color-role-worker1-soft)',
  },
  worker2: {
    displayLabel: 'Worker 2',
    panelClass:   'ui-role-panel-worker2',
    headerClass:  'ui-worker-header',
    accentColor:  'var(--color-role-worker2-accent)',
    accentSoft:   'var(--color-role-worker2-soft)',
  },
}

const DEFAULT_ROLE = {
  displayLabel: 'Agent',
  panelClass:   '',
  headerClass:  'ui-worker-header',
  accentColor:  'var(--color-neutral)',
  accentSoft:   'var(--color-neutral-soft)',
}

// ── Guide prompts (shown in empty state) ─────────────────────────────────────
const KICKOFF = '\nQuedate en standby esperando input y responde únicamente esto, sin agregar nada más:\nQuedo a la espera de que me envíes el material.'

const GUIDE_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  manager: [
    { label: 'Definir objetivo', prompt: 'Ayúdame a definir con claridad el objetivo principal de este trabajo. Reformúlalo en una frase central, identifica el resultado esperado y señala qué información falta para ejecutarlo bien.' + KICKOFF },
    { label: 'Pedir plan',       prompt: 'Propón un plan breve para resolver este trabajo. Divídelo en pasos concretos, ordénalos por prioridad y señala qué conviene hacer primero.' + KICKOFF },
    { label: 'Dividir tareas',   prompt: 'Divide este trabajo en tareas concretas para los workers. Quiero una lista clara de subtareas, cada una con objetivo, alcance y resultado esperado.' + KICKOFF },
  ],
  worker1: [
    { label: 'Resumir',    prompt: 'Resume este contenido de forma clara y breve. Conserva lo más importante, elimina redundancias y entrégalo en un formato fácil de leer.' + KICKOFF },
    { label: 'Corregir',   prompt: 'Corrige este texto mejorando claridad, redacción, estructura y precisión. No cambies el sentido original salvo que haya errores evidentes.' + KICKOFF },
    { label: 'Comparar',   prompt: 'Compara estas dos o más opciones. Marca diferencias, ventajas, desventajas y cuál parece más sólida según el objetivo planteado.' + KICKOFF },
  ],
  worker2: [
    { label: 'Redactar',      prompt: 'Redacta un primer borrador sobre este tema. Hazlo claro, ordenado y directamente utilizable, evitando relleno innecesario.' + KICKOFF },
    { label: 'Revisar',       prompt: 'Revisa este material como si fueras un editor crítico. Señala debilidades, inconsistencias, ambigüedades y mejoras concretas.' + KICKOFF },
    { label: 'Extraer ideas', prompt: 'Extrae las ideas principales de este contenido. Ordénalas por relevancia y conviértelas en una lista clara de puntos útiles para seguir trabajando.' + KICKOFF },
  ],
}

// ── Day marker helper ────────────────────────────────────────────────────────
interface DisplayMessage extends ChatMessage {
  created_at?: string
}

function formatDayMarker(date: Date): string {
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString())     return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ── Public interface ─────────────────────────────────────────────────────────
export interface AgentPanelHandle {
  getLastAssistantMessage(): string | undefined
  appendUserMessage(content: string): void
  getAllMessages(): ChatMessage[]
  restoreMessages(messages: ChatMessage[]): void
  getSelectedMessages(): ChatMessage[]
  clearSelection(): void
}

interface PanelSnapshot {
  role:         string
  panel:        string
  lastMessages: { role: 'user' | 'assistant'; content: string }[]
}

interface Props {
  session:           AgentSession
  initialMessages:   Message[]
  workspaceLocked:   boolean
  onSelectionChange: (count: number) => void
  forwardTargets?:   { role: string; label: string }[]
  onForward?:        (messages: ChatMessage[], targetRole: string) => void
  onCreateHandoff?:  () => void
  onSaveVersion?:    () => void
  onOpenSaveSelection?: () => void
  // SAT/MAT structured context (Capa 3 + 4)
  teamId?:                  string
  projectId?:               string
  teamType?:                'SAT' | 'MAT'
  getOtherPanelsSnapshot?:  () => PanelSnapshot[]
  initialInput?:            string
}

// ── Component ────────────────────────────────────────────────────────────────
const AgentPanel = forwardRef<AgentPanelHandle, Props>(
  ({
    session, initialMessages, workspaceLocked, onSelectionChange,
    forwardTargets, onForward, onCreateHandoff, onSaveVersion, onOpenSaveSelection,
    teamId, projectId, teamType, getOtherPanelsSnapshot, initialInput,
  }, ref) => {
    const role         = ROLE_CONFIG[session.agent_role] ?? DEFAULT_ROLE
    const guidePrompts = GUIDE_PROMPTS[session.agent_role] ?? GUIDE_PROMPTS.worker1

    // ── State ────────────────────────────────────────────────────────────────
    const [messages, setMessages]             = useState<DisplayMessage[]>(
      initialMessages.map(m => ({
        role:        m.role,
        content:     m.content,
        created_at:  m.created_at,
        attachments: m.attachment_metadata?.map(a => ({ ...a, data: '' })) ?? undefined,
      }))
    )
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
    const [input, setInput]                   = useState('')
    const [streaming, setStreaming]           = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [error, setError]                   = useState<string | null>(null)
    const [forwardTarget, setForwardTarget]   = useState(forwardTargets?.[0]?.role ?? '')
    const [showRefreshConfirm, setShowRefreshConfirm]   = useState(false)
    const [copiedIndex, setCopiedIndex]                 = useState<number | null>(null)
    const [autoRespond]                                 = useState(true)
    const [webSearchEnabled, setWebSearchEnabled]       = useState(false)
    const [showPromptLibrary,    setShowPromptLibrary]    = useState(false)
    const [showContextFilePanel, setShowContextFilePanel] = useState(false)
    const [apiMessages, setApiMessages]               = useState<ChatMessage[]>(
      initialMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    )
    const [attachments, setAttachments] = useState<ChatAttachment[]>([])
    const [isDragging,  setIsDragging]  = useState(false)
    const bottomRef    = useRef<HTMLDivElement>(null)
    const textareaRef  = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const selectedCount = selectedIndices.size
    const hasSelection  = selectedCount > 0

    // ── Selection ────────────────────────────────────────────────────────────
    function toggleSelection(i: number) {
      setSelectedIndices(prev => {
        const next = new Set(prev)
        if (next.has(i)) { next.delete(i) } else { next.add(i) }
        return next
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { onSelectionChange(selectedIndices.size) }, [selectedIndices.size])

    // Prefill input from onboarding
    useEffect(() => {
      if (initialInput) {
        setInput(initialInput)
      }
    }, [initialInput])

    // Scroll al final al montar — carga inicial de mensajes históricos
    useEffect(() => {
      if (initialMessages.length > 0) {
        setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }) }, 100)
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getLastAssistantMessage: () =>
        [...messages].reverse().find(m => m.role === 'assistant')?.content,
      appendUserMessage: (content: string) => {
        if (autoRespond) {
          // sendPrompt handles message insertion + API call — no duplication
          setTimeout(() => sendPrompt(content), 50)
        } else {
          setMessages(prev => [...prev, { role: 'user', content, created_at: new Date().toISOString() }])
          setApiMessages(prev => [...prev, { role: 'user', content }])
        }
      },
      getAllMessages:    () => messages,
      restoreMessages: (msgs: ChatMessage[]) => {
        setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
        setApiMessages(msgs)
        setSelectedIndices(new Set())
        onSelectionChange(0)
      },
      getSelectedMessages: () =>
        Array.from(selectedIndices).sort((a, b) => a - b).map(i => messages[i]).filter(Boolean),
      clearSelection: () => {
        setSelectedIndices(new Set())
        onSelectionChange(0)
      },
    }))

    // ── Handlers ─────────────────────────────────────────────────────────────
    async function handleAuditAiAnswer() {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: session.workspace_id,
          event_type:  'audit_ai_answer',
          metadata: {
            agent_role:   session.agent_role,
            triggered_at: new Date().toISOString(),
            status:       'initiated',
          },
        }),
      }).catch(() => {})
    }

    function handleForward() {
      if (!onForward || !hasSelection) return
      const selected = Array.from(selectedIndices)
        .sort((a, b) => a - b)
        .map(i => messages[i])
        .filter(Boolean)
      onForward(selected, forwardTarget)
      setSelectedIndices(new Set())
      onSelectionChange(0)
    }

    async function copyMessage(index: number, content: string) {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    }

    async function handleRefreshSession() {
      setApiMessages([])
      setShowRefreshConfirm(false)
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: session.workspace_id,
          event_type:  'session_refresh',
          metadata:    { agent_role: session.agent_role },
        }),
      }).catch(() => {})
    }

    function scrollToBottom() {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault()
      setIsDragging(true)
    }

    function handleDragLeave() {
      setIsDragging(false)
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (!files.length) return
      const dt = new DataTransfer()
      files.forEach(f => dt.items.add(f))
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
      const files = Array.from(e.target.files ?? [])
      const newAtts: ChatAttachment[] = await Promise.all(
        files.map(file => new Promise<ChatAttachment>(resolve => {
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve({
              type:       file.type.startsWith('image/') ? 'image' : 'document',
              media_type: file.type,
              data:       base64,
              name:       file.name,
            })
          }
          reader.readAsDataURL(file)
        }))
      )
      setAttachments(prev => [...prev, ...newAtts])
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (session.provider === 'Groq' && newAtts.length > 0) {
        setError('Groq does not currently support file attachments or vision input. This attachment will not be processed by the model.')
      }
    }

    async function sendPrompt(content: string, atts: ChatAttachment[] = []) {
      if ((!content && !atts.length) || streaming || workspaceLocked) return

      const userMsg: DisplayMessage  = { role: 'user', content, created_at: new Date().toISOString(), attachments: atts.length ? atts : undefined }
      const userApiMsg: ChatMessage = { role: 'user', content, ...(atts.length ? { attachments: atts } : {}) }
      const newApiMessages: ChatMessage[] = [...apiMessages, userApiMsg]

      setMessages(prev => [...prev, userMsg])
      setApiMessages(newApiMessages)
      setStreaming(true)
      setStreamingContent('')
      setError(null)
      scrollToBottom()

      let fullContent = ''

      try {
        // ERR-003: persistir userMsg antes del stream — un corte de red no debe
        // borrar la acción del usuario. Fail-open: si falla, el chat continúa.
        try {
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session.id, messages: [userMsg] }),
          })
        } catch (persistErr) {
          console.error('[AgentPanel] failed to persist userMsg before stream', persistErr)
        }

        const agentRole = session.agent_role === 'manager' ? 'manager' : 'worker'

        // SAT: always share other panels' context. MAT: no snapshot (no active forward flag).
        const otherPanelsSnapshot: PanelSnapshot[] =
          teamType === 'SAT' ? (getOtherPanelsSnapshot?.() ?? []) : []

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages:  newApiMessages,
            provider:  session.provider,
            model:     session.model,
            agentRole,
            webSearchEnabled,
            ...(session.config?.endpoint ? { endpoint: session.config.endpoint } : {}),
            team_id:              teamId   ?? null,
            workspace_id:         session.workspace_id,
            team_type:            teamType ?? null,
            panel_id:             session.agent_role,
            session_id:           session.id,
            otherPanelsSnapshot,
          }),
        })

        if (!res.ok) {
          let msg = 'Server error'
          try {
            const body = await res.json()
            msg = body.error ?? msg
          } catch {
            msg = await res.text().catch(() => msg)
          }
          throw new Error(msg)
        }

        const reader  = res.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullContent += decoder.decode(value, { stream: true })
          setStreamingContent(fullContent)
          scrollToBottom()
        }

        const assistantMsg: DisplayMessage = {
          role: 'assistant', content: fullContent, created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
        setApiMessages(prev => [...prev, { role: 'assistant', content: fullContent }])

        // Solo assistantMsg — userMsg ya fue persistido antes del stream (ERR-003)
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, messages: [assistantMsg] }),
        })
      } catch (err) {
        // ERR-003: si el stream se cortó con contenido parcial, conservarlo y
        // persistirlo como mensaje interrumpido en vez de descartarlo.
        if (fullContent.trim().length > 0) {
          const interruptedMsg: DisplayMessage = {
            role:       'assistant',
            content:    fullContent + '\n\n⚠️ Response interrupted — the connection was lost mid-stream.',
            created_at: new Date().toISOString(),
          }
          setMessages(prev => [...prev, interruptedMsg])
          setApiMessages(prev => [...prev, { role: 'assistant', content: interruptedMsg.content }])
          try {
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: session.id, messages: [interruptedMsg] }),
            })
          } catch (persistErr) {
            console.error('[AgentPanel] failed to persist interrupted message', persistErr)
          }
          setError('The response was interrupted. Your message has been saved.')
        } else {
          // Error pre-stream (400 sin key, 429, red) — mantener el mensaje accionable real
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        setStreamingContent('')
        setStreaming(false)
        scrollToBottom()
      }
    }

    async function sendMessage() {
      const content = input.trim()
      if (!content && !attachments.length) return
      const pendingAtts = attachments
      setInput('')
      setAttachments([])
      if (textareaRef.current) textareaRef.current.style.height = '36px'
      await sendPrompt(content, pendingAtts)
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
      <Fragment>
      <div className={`ui-role-panel ${role.panelClass} h-full flex min-h-0 min-w-0 flex-col overflow-hidden`}>

        {/* ── SECTION 1: Header ─────────────────────────────────────────── */}
        <div className={`ui-chat-panel-header shrink-0 ${role.headerClass} px-3 py-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span
                aria-hidden="true"
                className="ui-role-dot mt-0.5 shrink-0"
                style={{
                  backgroundColor: role.accentColor,
                  boxShadow: `0 0 0 4px ${role.accentSoft}`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase truncate"
                  style={{ color: 'var(--color-text-primary)' }}>
                  {role.displayLabel} · {session.provider}
                </div>
                <div className="ui-chat-panel-meta">
                  {session.model}
                  {hasSelection && (
                    <span className="ml-2" style={{ color: role.accentColor }}>
                      · {selectedCount} sel.
                    </span>
                  )}
                  {autoRespond && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded border border-[var(--color-border-default)] text-[var(--color-text-muted)]">
                      Auto-respond: ON
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setWebSearchEnabled(prev => !prev)}
                    className={`ml-2 text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                      webSearchEnabled
                        ? 'bg-[var(--color-accent,#0ea5e9)] text-white border-transparent'
                        : 'text-[var(--color-text-muted)] border-[var(--color-border-default)]'
                    }`}
                    title="Toggle web search"
                  >
                    {webSearchEnabled ? 'Web search: ON' : 'Web search: OFF'}
                  </button>
                </div>
                {session.description && (
                  <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {session.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Tools row ──────────────────────────────────────── */}
        <div className="shrink-0 px-3 py-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="ui-chat-tools-row">
            <button
              className="ui-chat-prompt shrink-0"
              onClick={() => setShowPromptLibrary(true)}
            >
              Prompt Library
            </button>
            <button
              className="ui-chat-prompt shrink-0"
              onClick={() => setShowContextFilePanel(true)}
            >
              Add Context File
            </button>
          </div>
        </div>

        {/* ── SECTION 3: Viewport (messages) ────────────────────────────── */}
        <div
          className="ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-2"
          style={{ minHeight: 0 }}
        >
          {/* Empty state */}
          {messages.length === 0 && !streaming && (
            <div className="h-full flex items-center justify-center py-8">
              <div className="ui-empty-state w-full max-w-xs">
                <div className="ui-empty-state-title text-sm" style={{ color: role.accentColor }}>
                  {session.agent_role === 'manager' ? 'Define el objetivo' : 'Pide una tarea concreta'}
                </div>
                <p className="ui-empty-state-copy text-xs mt-1">
                  {session.agent_role === 'manager'
                    ? 'Plantea el problema, la meta o la decisión a tomar.'
                    : 'Usa este panel para ejecutar un trabajo puntual.'
                  }
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {guidePrompts.map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => sendPrompt(prompt)}
                      disabled={workspaceLocked || streaming}
                      className="ui-button text-xs px-3 disabled:opacity-40"
                      style={{ color: role.accentColor, minHeight: '2rem' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => {
              const isSelected = selectedIndices.has(i)
              const isUser     = msg.role === 'user'

              const showDayMarker = !!msg.created_at && (
                i === 0 ||
                !messages[i - 1]?.created_at ||
                new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at!).toDateString()
              )

              return (
                <Fragment key={i}>
                  {showDayMarker && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                      <span
                        className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border shrink-0"
                        style={{
                          color: 'var(--color-text-tertiary)',
                          borderColor: 'var(--color-border)',
                          background: 'var(--color-surface-muted)',
                        }}
                        suppressHydrationWarning
                      >
                        {formatDayMarker(new Date(msg.created_at!))}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>
                  )}

                  <div className={`group flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {/* Selection toggle */}
                    <button
                      onClick={() => toggleSelection(i)}
                      className={`ui-message-select mt-0.5 shrink-0 transition-opacity ${
                        isSelected
                          ? 'ui-message-select-selected opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label={isSelected ? 'Deselect message' : 'Select message'}
                    >
                      {isSelected && <span className="ui-message-select-tick">✓</span>}
                    </button>

                    {/* Bubble — clickable to select, text is selectable */}
                    <div
                      className={`relative max-w-[88%] cursor-pointer group/msg ${isUser ? 'order-1' : ''}`}
                      onClick={() => toggleSelection(i)}
                    >
                      <div
                        className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <span>{isUser ? 'User' : role.displayLabel}</span>
                        {msg.created_at && (
                          <span suppressHydrationWarning>{formatMessageTime(msg.created_at)}</span>
                        )}
                      </div>
                      <div
                        className={`relative ui-message-bubble px-3 py-2 text-xs leading-5 ${
                          isUser ? 'ui-message-bubble-user' : ''
                        } ${isSelected ? 'ui-message-bubble-selected' : ''}`}
                      >
                        {/* Enterprise: copy button visibility configurable via workspace settings */}
                        <button
                          className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover/msg:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-text-muted)' }}
                          onClick={e => { e.stopPropagation(); copyMessage(i, msg.content) }}
                          title="Copy message"
                        >
                          {copiedIndex === i
                            ? <Check size={12} />
                            : <Copy size={12} />
                          }
                        </button>
                        <div className="whitespace-pre-wrap select-text pr-4">{msg.content}</div>
                        {msg.attachments?.map((att, j) => (
                          <div key={j} className="mt-1.5 flex items-center gap-1.5 text-[10px] opacity-60 border border-current/20 rounded px-1.5 py-0.5 w-fit">
                            {att.type === 'image' ? <ImageIcon size={10} /> : <FileText size={10} />}
                            <span>{att.name || att.media_type || 'File attached'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })}

            {/* Streaming indicator */}
            {streaming && (
              <div className="flex items-start gap-2">
                <div className="ui-message-select opacity-0 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="max-w-[88%]">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {role.displayLabel}
                  </div>
                  <div className="ui-message-bubble px-3 py-2 text-xs leading-5">
                    <div className="whitespace-pre-wrap">
                      {streamingContent || (
                        <span className="animate-pulse" style={{ color: 'var(--color-text-muted)' }}>▊</span>
                      )}
                      {streamingContent && (
                        <span className="animate-pulse" style={{ color: 'var(--color-text-muted)' }}>▊</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-lg px-3 py-2 text-xs border"
                style={{
                  background: 'var(--color-danger-soft)',
                  borderColor: 'rgba(180,35,24,0.22)',
                  color: 'var(--color-danger)',
                }}
              >
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── SECTION 4: Composer ────────────────────────────────────────── */}
        <div
          className={`ui-chat-composer-section shrink-0 px-3 py-1.5 rounded transition-shadow${isDragging ? ' ring-2 ring-[var(--color-accent,#0ea5e9)]' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1.5">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
                  style={{
                    background: 'var(--color-surface-secondary,#f0f0f0)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {att.name ?? att.type}
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="hover:opacity-70 ml-0.5"
                    aria-label="Remove attachment"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="ui-chat-composer">
            <textarea
              ref={textareaRef}
              className="ui-chat-composer-input"
              placeholder={workspaceLocked ? 'Panel locked' : `Message ${role.displayLabel}…`}
              value={input}
              disabled={workspaceLocked || streaming}
              rows={1}
              style={{ resize: 'none', minHeight: '36px', maxHeight: '96px', overflowY: 'auto' }}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={workspaceLocked || streaming}
              className="shrink-0 px-1.5 disabled:opacity-40"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Attach file"
            >
              📎
            </button>
            <button
              className="ui-button ui-button-primary ui-chat-send text-xs text-white disabled:opacity-40"
              onClick={sendMessage}
              disabled={(!input.trim() && !attachments.length) || streaming || workspaceLocked}
            >
              {streaming ? '…' : 'Send'}
            </button>
          </div>
        </div>

        {/* ── SECTION 5: Forward section ─────────────────────────────────── */}
        <div className="ui-chat-forward-section shrink-0 px-3 py-1.5">
          <div className="ui-forward-stack">
            <div className="ui-forward-row">
              <div className="ui-forward-select-wrap">
                <select
                  className="ui-forward-select"
                  value={forwardTarget}
                  onChange={e => setForwardTarget(e.target.value)}
                  disabled={!forwardTargets?.length || workspaceLocked}
                >
                  {forwardTargets?.map(t => (
                    <option key={t.role} value={t.role}>{t.label}</option>
                  ))}
                  {!forwardTargets?.length && (
                    <option value="">Select destination</option>
                  )}
                </select>
                <span className="ui-forward-select-caret">v</span>
              </div>
              <button
                className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40"
                onClick={handleForward}
                disabled={!hasSelection || !onForward || workspaceLocked}
                title="Review and forward selected messages"
              >
                Review & Forward
              </button>
            </div>
            <button
              className="ui-button ui-button-handoff ui-chat-action-button px-3 text-xs disabled:opacity-40"
              onClick={onCreateHandoff}
              disabled={!onCreateHandoff || !hasSelection || workspaceLocked}
              title="Create a handoff package from selected messages"
            >
              Create Handoff Package
            </button>
          </div>
        </div>

        {/* ── SECTION 6: Actions grid ────────────────────────────────────── */}
        <div className="ui-chat-actions-section shrink-0 px-3 pb-2 pt-1">
          {showRefreshConfirm ? (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                Reset AI context? (history stays visible)
              </span>
              <div className="flex gap-1.5">
                <button
                  className="ui-button px-3 text-[11px]"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => setShowRefreshConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="ui-button ui-button-primary text-[11px] text-white px-3"
                  onClick={handleRefreshSession}
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              <button
                className="ui-button px-2 text-[11px] disabled:opacity-40"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => setShowRefreshConfirm(true)}
                title="Resets the AI context while keeping your chat history visible."
              >
                Refresh Session
              </button>
              <button
                className="ui-button px-2 text-[11px] disabled:opacity-40"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={onSaveVersion}
                disabled={!onSaveVersion || messages.length === 0}
                title="Save a checkpoint of this session"
              >
                Save Version
              </button>
              <button
                className="ui-button px-2 text-[11px] disabled:opacity-40"
                style={{ color: hasSelection ? 'var(--color-accent-strong)' : 'var(--color-text-secondary)' }}
                disabled={!hasSelection}
                onClick={onOpenSaveSelection}
                title="Save selected messages"
              >
                {hasSelection
                  ? (selectedCount === 1 ? 'Save Selection (1)' : `Save Selections (${selectedCount})`)
                  : 'Save Selection'}
              </button>
              <button
                className="ui-button ui-button-primary px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-40"
                onClick={handleAuditAiAnswer}
                disabled={workspaceLocked || !hasSelection}
                title="Audit AI Answer"
              >
                Audit AI
              </button>
            </div>
          )}
        </div>

      </div>

      <PromptLibrary
        open={showPromptLibrary}
        onClose={() => setShowPromptLibrary(false)}
        teamId={teamId ?? ''}
        teamType={teamType}
        workspaceId={session.workspace_id}
        sessionId={session.id}
        agentRole={session.agent_role}
      />

      <ContextFilePanel
        open={showContextFilePanel}
        onClose={() => setShowContextFilePanel(false)}
        teamId={teamId ?? undefined}
        projectId={projectId}
        workspaceId={session.workspace_id}
        sessionId={session.id}
      />
      </Fragment>
    )
  }
)

AgentPanel.displayName = 'AgentPanel'
export default AgentPanel
