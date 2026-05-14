'use client'

import { Fragment, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { AgentSession, Message } from '@/lib/db/types'
import type { ChatMessage } from '@/lib/providers/types'

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

// ── Public interface ─────────────────────────────────────────────────────────
export interface AgentPanelHandle {
  getLastAssistantMessage(): string | undefined
  appendUserMessage(content: string): void
  getAllMessages(): ChatMessage[]
  restoreMessages(messages: ChatMessage[]): void
  getSelectedMessages(): ChatMessage[]
  clearSelection(): void
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
}

// ── Component ────────────────────────────────────────────────────────────────
const AgentPanel = forwardRef<AgentPanelHandle, Props>(
  ({
    session, initialMessages, workspaceLocked, onSelectionChange,
    forwardTargets, onForward, onCreateHandoff, onSaveVersion,
  }, ref) => {
    const role         = ROLE_CONFIG[session.agent_role] ?? DEFAULT_ROLE
    const guidePrompts = GUIDE_PROMPTS[session.agent_role] ?? GUIDE_PROMPTS.worker1

    // ── State ────────────────────────────────────────────────────────────────
    const [messages, setMessages]             = useState<DisplayMessage[]>(
      initialMessages.map(m => ({ role: m.role, content: m.content, created_at: m.created_at }))
    )
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
    const [input, setInput]                   = useState('')
    const [streaming, setStreaming]           = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [error, setError]                   = useState<string | null>(null)
    const [forwardTarget, setForwardTarget]   = useState(forwardTargets?.[0]?.role ?? '')
    const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
    const [copiedIndex, setCopiedIndex]               = useState<number | null>(null)
    const [apiMessages, setApiMessages]               = useState<ChatMessage[]>(
      initialMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    )
    const bottomRef   = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const selectedCount = selectedIndices.size
    const hasSelection  = selectedCount > 0

    // ── Selection ────────────────────────────────────────────────────────────
    function toggleSelection(i: number) {
      setSelectedIndices(prev => {
        const next = new Set(prev)
        if (next.has(i)) { next.delete(i) } else { next.add(i) }
        onSelectionChange(next.size)
        return next
      })
    }

    // ── Imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getLastAssistantMessage: () =>
        [...messages].reverse().find(m => m.role === 'assistant')?.content,
      appendUserMessage: (content: string) =>
        setMessages(prev => [...prev, { role: 'user', content, created_at: new Date().toISOString() }]),
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

    async function sendPrompt(content: string) {
      if (!content || streaming || workspaceLocked) return

      const userMsg: DisplayMessage  = { role: 'user', content, created_at: new Date().toISOString() }
      const newApiMessages: ChatMessage[] = [...apiMessages, { role: 'user', content }]

      setMessages(prev => [...prev, userMsg])
      setApiMessages(newApiMessages)
      setStreaming(true)
      setStreamingContent('')
      setError(null)
      scrollToBottom()

      let fullContent = ''

      try {
        const agentRole = session.agent_role === 'manager' ? 'manager' : 'worker'

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages:  newApiMessages,
            provider:  session.provider,
            model:     session.model,
            agentRole,
            ...(session.config?.endpoint ? { endpoint: session.config.endpoint } : {}),
          }),
        })

        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Server error')
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

        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, messages: [userMsg, assistantMsg] }),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setStreamingContent('')
        setStreaming(false)
        scrollToBottom()
      }
    }

    async function sendMessage() {
      const content = input.trim()
      if (!content) return
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = '36px'
      await sendPrompt(content)
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Tools row ──────────────────────────────────────── */}
        <div className="shrink-0 px-3 py-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="ui-chat-tools-row">
            {(['Prompt Library', 'Add Context File'] as const).map(label => (
              <div key={label} className="relative group">
                <button className="ui-chat-prompt shrink-0" style={{ cursor: 'default' }}>
                  {label}
                </button>
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  style={{ background: 'var(--color-surface-inverse)', color: 'var(--color-text-inverse)' }}
                >
                  Coming soon — available in an upcoming release
                </span>
              </div>
            ))}
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
        <div className="ui-chat-composer-section shrink-0 px-3 py-1.5">
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
              className="ui-button ui-button-primary ui-chat-send text-xs text-white disabled:opacity-40"
              onClick={sendMessage}
              disabled={!input.trim() || streaming || workspaceLocked}
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
                title="Save selected messages"
              >
                {hasSelection ? `Selection (${selectedCount})` : 'Save Selection'}
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
    )
  }
)

AgentPanel.displayName = 'AgentPanel'
export default AgentPanel
