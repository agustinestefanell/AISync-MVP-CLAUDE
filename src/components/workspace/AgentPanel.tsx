'use client'

import { Fragment, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { AgentSession, Message } from '@/lib/db/types'
import type { ChatMessage } from '@/lib/providers/types'

const AGENT_META: Record<string, { label: string; color: string; bg: string }> = {
  manager: { label: 'Manager',  color: 'text-blue-400',   bg: 'bg-blue-950 border-blue-900' },
  worker1: { label: 'Worker 1', color: 'text-teal-400',   bg: 'bg-teal-950 border-teal-900' },
  worker2: { label: 'Worker 2', color: 'text-orange-400', bg: 'bg-orange-950 border-orange-900' },
}

const KICKOFF = '\nQuedate en standby esperando input y responde únicamente esto, sin agregar nada más:\nQuedo a la espera de que me envíes el material.'

const GUIDE_META: Record<string, { iconBg: string; title: string; subtitle: string; btnCls: string }> = {
  manager: {
    iconBg:   'bg-blue-500',
    title:    'Empieza por el objetivo',
    subtitle: 'Plantea el problema, la meta o la decisión a tomar.',
    btnCls:   'border-blue-700 text-blue-300 hover:border-blue-500 hover:text-blue-100 hover:bg-blue-950/40',
  },
  worker1: {
    iconBg:   'bg-teal-500',
    title:    'Pide una tarea concreta',
    subtitle: 'Usa este panel para ejecutar un trabajo puntual.',
    btnCls:   'border-teal-700 text-teal-300 hover:border-teal-500 hover:text-teal-100 hover:bg-teal-950/40',
  },
  worker2: {
    iconBg:   'bg-orange-500',
    title:    'Pide una tarea concreta',
    subtitle: 'Usa este panel para ejecutar un trabajo puntual.',
    btnCls:   'border-orange-700 text-orange-300 hover:border-orange-500 hover:text-orange-100 hover:bg-orange-950/40',
  },
}

const GUIDE_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  manager: [
    {
      label:  'Definir objetivo',
      prompt: 'Ayúdame a definir con claridad el objetivo principal de este trabajo. Reformúlalo en una frase central, identifica el resultado esperado y señala qué información falta para ejecutarlo bien.' + KICKOFF,
    },
    {
      label:  'Pedir plan',
      prompt: 'Propón un plan breve para resolver este trabajo. Divídelo en pasos concretos, ordénalos por prioridad y señala qué conviene hacer primero.' + KICKOFF,
    },
    {
      label:  'Dividir tareas',
      prompt: 'Divide este trabajo en tareas concretas para los workers. Quiero una lista clara de subtareas, cada una con objetivo, alcance y resultado esperado.' + KICKOFF,
    },
  ],
  worker1: [
    {
      label:  'Resumir',
      prompt: 'Resume este contenido de forma clara y breve. Conserva lo más importante, elimina redundancias y entrégalo en un formato fácil de leer.' + KICKOFF,
    },
    {
      label:  'Corregir',
      prompt: 'Corrige este texto mejorando claridad, redacción, estructura y precisión. No cambies el sentido original salvo que haya errores evidentes.' + KICKOFF,
    },
    {
      label:  'Comparar',
      prompt: 'Compara estas dos o más opciones. Marca diferencias, ventajas, desventajas y cuál parece más sólida según el objetivo planteado.' + KICKOFF,
    },
  ],
  worker2: [
    {
      label:  'Redactar',
      prompt: 'Redacta un primer borrador sobre este tema. Hazlo claro, ordenado y directamente utilizable, evitando relleno innecesario.' + KICKOFF,
    },
    {
      label:  'Revisar',
      prompt: 'Revisa este material como si fueras un editor crítico. Señala debilidades, inconsistencias, ambigüedades y mejoras concretas.' + KICKOFF,
    },
    {
      label:  'Extraer ideas',
      prompt: 'Extrae las ideas principales de este contenido. Ordénalas por relevancia y conviértelas en una lista clara de puntos útiles para seguir trabajando.' + KICKOFF,
    },
  ],
}

// Internal message type — preserves created_at for day markers without touching the shared ChatMessage type
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
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

export interface AgentPanelHandle {
  getLastAssistantMessage(): string | undefined
  appendUserMessage(content: string): void
  getAllMessages(): ChatMessage[]
  restoreMessages(messages: ChatMessage[]): void
  getSelectedMessages(): ChatMessage[]
  clearSelection(): void
}

interface Props {
  session: AgentSession
  initialMessages: Message[]
  workspaceLocked: boolean
  onSelectionChange: (count: number) => void
}

const AgentPanel = forwardRef<AgentPanelHandle, Props>(
  ({ session, initialMessages, workspaceLocked, onSelectionChange }, ref) => {
    const meta = AGENT_META[session.agent_role] ?? {
      label: session.agent_role,
      color: 'text-gray-400',
      bg: 'bg-gray-900 border-gray-800',
    }
    const guide     = GUIDE_META[session.agent_role]    ?? GUIDE_META.worker1
    const guideBtns = GUIDE_PROMPTS[session.agent_role] ?? GUIDE_PROMPTS.worker1

    const [messages, setMessages] = useState<DisplayMessage[]>(
      initialMessages.map(m => ({ role: m.role, content: m.content, created_at: m.created_at }))
    )
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
    const [input, setInput]                     = useState('')
    const [streaming, setStreaming]             = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [error, setError]                     = useState<string | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)

    function toggleSelection(i: number) {
      setSelectedIndices(prev => {
        const next = new Set(prev)
        if (next.has(i)) { next.delete(i) } else { next.add(i) }
        onSelectionChange(next.size)
        return next
      })
    }

    useImperativeHandle(ref, () => ({
      getLastAssistantMessage: () =>
        [...messages].reverse().find(m => m.role === 'assistant')?.content,
      appendUserMessage: (content: string) =>
        setMessages(prev => [...prev, { role: 'user', content, created_at: new Date().toISOString() }]),
      getAllMessages: () => messages,
      restoreMessages: (msgs: ChatMessage[]) => {
        setMessages(msgs)
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

    function scrollToBottom() {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }

    async function sendPrompt(content: string) {
      if (!content || streaming || workspaceLocked) return

      const userMsg: DisplayMessage = { role: 'user', content, created_at: new Date().toISOString() }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
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
            messages:  nextMessages.map(({ role, content }) => ({ role, content })),
            provider:  session.provider,
            model:     session.model,
            agentRole,
            ...(session.config?.endpoint ? { endpoint: session.config.endpoint } : {}),
          }),
        })

        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Error del servidor')
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

        const assistantMsg: DisplayMessage = { role: 'assistant', content: fullContent, created_at: new Date().toISOString() }
        setMessages(prev => [...prev, assistantMsg])

        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, messages: [userMsg, assistantMsg] }),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
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
      await sendPrompt(content)
    }

    return (
      <div className="flex flex-col min-h-0 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

        {/* Cabecera */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
              {session.provider}
            </span>
            {selectedIndices.size > 0 && (
              <span className="text-xs text-indigo-400 bg-indigo-950 border border-indigo-900 px-2 py-0.5 rounded-full">
                {selectedIndices.size} sel.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{session.model}</span>
            <button
              onClick={handleAuditAiAnswer}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-600 px-2 py-0.5 rounded transition-colors"
            >
              Audit AI Answer
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && !streaming && (
            <div className="h-full flex items-center justify-center px-4 pb-8">
              <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-[18px] w-full max-w-[340px] flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-md shrink-0 ${guide.iconBg}`} />
                  <span className="text-base font-semibold text-white leading-tight">{guide.title}</span>
                </div>
                <p className="text-sm text-gray-400">{guide.subtitle}</p>
                <div className="flex gap-2 mt-1">
                  {guideBtns.map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => sendPrompt(prompt)}
                      disabled={workspaceLocked}
                      className={`flex-1 text-sm font-medium h-9 rounded-xl border bg-transparent transition-colors disabled:opacity-40 ${guide.btnCls}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isSelected = selectedIndices.has(i)

            const showDayMarker = !!msg.created_at && (
              i === 0 ||
              !messages[i - 1]?.created_at ||
              new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at!).toDateString()
            )

            return (
              <Fragment key={i}>
                {showDayMarker && (
                  <div className="flex items-center gap-3 my-3 px-2">
                    <div className="flex-1 h-px bg-gray-700/50" />
                    <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-800/50 rounded-full border border-gray-700/30 shrink-0" suppressHydrationWarning>
                      {formatDayMarker(new Date(msg.created_at!))}
                    </span>
                    <div className="flex-1 h-px bg-gray-700/50" />
                  </div>
                )}
                <div className="group flex items-start gap-1.5">
                  {/* Checkbox — oculto por defecto, visible al hover o cuando está chequeado */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(i)}
                    className={`mt-2 shrink-0 w-3.5 h-3.5 accent-indigo-500 cursor-pointer transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                    }`}
                  />
                  {/* Burbuja — empuja el mensaje a la derecha si es del usuario */}
                  <div className={`flex-1 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap transition-all ${
                        msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-200'
                      } ${isSelected ? 'ring-2 ring-indigo-400/60' : ''}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })}

          {streaming && (
            <div className="flex items-start gap-1.5">
              <div className="w-3.5 shrink-0" /> {/* placeholder del checkbox */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800 text-gray-200">
                  {streamingContent || <span className="animate-pulse text-gray-500">▊</span>}
                  {streamingContent && <span className="animate-pulse text-gray-500">▊</span>}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg px-3 py-2 bg-red-950 border border-red-900 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 border-t border-gray-800 flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            disabled={workspaceLocked || streaming}
            placeholder={workspaceLocked ? 'Workspace bloqueado' : 'Mensaje… (Enter para enviar)'}
            rows={2}
            className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming || workspaceLocked}
            className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {streaming ? '…' : 'Send'}
          </button>
        </div>
      </div>
    )
  }
)

AgentPanel.displayName = 'AgentPanel'
export default AgentPanel
