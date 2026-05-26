'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '@/lib/providers/types'
import SMDisambiguationModal from './SMDisambiguationModal'

const PROVIDER_MODELS: Record<string, string[]> = {
  'IA Local':  [],
  'Anthropic': ['Claude Sonnet', 'Claude 3 Haiku', 'Claude 3 Opus'],
  'OpenAI':    ['GPT-4o', 'GPT-4 Turbo', 'GPT-3.5 Turbo'],
  'Google':    ['Gemini 2.5 Flash', 'Gemini 1.5 Pro'],
}

const LOCAL_PROVIDERS = new Set(['IA Local'])
const LS_KEY          = 'sm-connection'
const LS_MSGS_KEY     = 'sm-messages'
const LS_OPEN_KEY     = 'sm-panel-open'

interface Connection {
  provider: string
  model:    string
  endpoint: string
  isLocal:  boolean
}

export interface CustomProvider {
  name:  string
  model: string
}

export interface SMCheckpoint {
  id:        string
  name:      string
  team?:     string
  workspace?: string
  project?:  string
  date?:     string
  purpose?:  string
}

interface Props {
  pageContext:          string
  pageName:            string
  customProviders?:    CustomProvider[]
  checkpoints?:        SMCheckpoint[]
  onSelectCheckpoint?: (id: string) => void
}

function readOpenState(): boolean {
  try { return localStorage.getItem(LS_OPEN_KEY) === '1' } catch { return false }
}

export default function SMPanel({
  pageContext, pageName, customProviders = [], checkpoints = [], onSelectCheckpoint,
}: Props) {
  const [open,        setOpen]        = useState(readOpenState)
  const [showConsent, setShowConsent] = useState(false)
  const [connection,  setConnection]  = useState<Connection | null>(null)

  const [selProvider, setSelProvider] = useState('IA Local')
  const [selModel,    setSelModel]    = useState('mistral')
  const [selEndpoint, setSelEndpoint] = useState('http://localhost:11434/v1')

  const [messages,          setMessages]          = useState<ChatMessage[]>([])
  const [input,             setInput]             = useState('')
  const [streaming,         setStreaming]          = useState(false)
  const [streamingContent,  setStreamingContent]  = useState('')
  const [error,             setError]             = useState<string | null>(null)
  const [disambigResults,   setDisambigResults]   = useState<SMCheckpoint[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const contextStatus = useMemo(() => {
    const firstLine = pageContext.split('\n')[0] ?? ''
    if (firstLine.includes('FILTERED')) return 'filtered' as const
    if (firstLine.includes('FULL'))     return 'full'     as const
    return null
  }, [pageContext])

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const savedConn = localStorage.getItem(LS_KEY)
      if (savedConn) {
        const { provider, model, endpoint } = JSON.parse(savedConn) as {
          provider: string; model: string; endpoint: string
        }
        const isLocal = LOCAL_PROVIDERS.has(provider)
        setConnection({ provider, model, endpoint: endpoint ?? '', isLocal })
      }
      const savedMsgs = localStorage.getItem(LS_MSGS_KEY)
      if (savedMsgs) setMessages(JSON.parse(savedMsgs) as ChatMessage[])
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_MSGS_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    try { localStorage.setItem(LS_OPEN_KEY, open ? '1' : '0') } catch {}
  }, [open])

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleConnect() {
    const isLocal = LOCAL_PROVIDERS.has(selProvider)
    setConnection({ provider: selProvider, model: selModel, endpoint: selEndpoint, isLocal })
    setShowConsent(false)
    setError(null)
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: selProvider, model: selModel, endpoint: selEndpoint }))
  }

  function handleDisconnect() {
    setConnection(null)
    setStreamingContent('')
    setError(null)
    localStorage.removeItem(LS_KEY)
  }

  function handleClearChat() {
    setMessages([])
    localStorage.removeItem(LS_MSGS_KEY)
  }

  function handleProviderChange(p: string) {
    setSelProvider(p)
    const builtIn = PROVIDER_MODELS[p]
    if (builtIn !== undefined) {
      setSelModel(builtIn[0] ?? '')
    } else {
      const custom = customProviders.find(c => c.name === p)
      setSelModel(custom?.model ?? '')
    }
  }

  async function sendMessage() {
    if (!connection) return
    const content = input.trim()
    if (!content || streaming) return

    const userMsg: ChatMessage = { role: 'user', content }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)
    setStreamingContent('')
    setError(null)
    scrollToBottom()

    let fullContent = ''

    try {
      const res = await fetch('/api/sm-doc-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages, pageContext, pageName,
          provider: connection.provider, model: connection.model, endpoint: connection.endpoint,
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
      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setStreamingContent('')
      setStreaming(false)
      scrollToBottom()
    }
  }

  function collectMatches(text: string): SMCheckpoint[] {
    const matched: SMCheckpoint[] = []
    for (const cp of checkpoints) {
      const escaped = cp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(escaped, 'gi').test(text)) matched.push(cp)
    }
    return matched
  }

  function renderAssistantMessage(text: string): React.ReactNode {
    if (!checkpoints.length) return <span className="whitespace-pre-wrap">{text}</span>
    const matched = collectMatches(text)

    if (matched.length > 1) {
      return (
        <span className="whitespace-pre-wrap">
          {text}{'\n'}
          <button
            onClick={() => setDisambigResults(matched)}
            className="inline-block mt-1 text-blue-400 underline cursor-pointer hover:text-blue-300 transition-colors"
          >
            View {matched.length} results →
          </button>
        </span>
      )
    }

    if (matched.length === 0) return <span className="whitespace-pre-wrap">{text}</span>

    let result: (string | React.ReactElement)[] = [text]
    const cp = matched[0]
    const escaped = cp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex   = new RegExp(escaped, 'gi')

    result = result.flatMap((node, nodeIdx): (string | React.ReactElement)[] => {
      if (typeof node !== 'string') return [node]
      const parts   = node.split(regex)
      const matches = node.match(regex) ?? []
      return parts.flatMap((part, i): (string | React.ReactElement)[] => {
        const out: (string | React.ReactElement)[] = part ? [part] : []
        if (matches[i]) {
          out.push(
            <button
              key={`${cp.id}-${nodeIdx}-${i}`}
              onClick={() => onSelectCheckpoint?.(cp.id)}
              className="text-blue-500 underline cursor-pointer"
            >
              {matches[i]}
            </button>
          )
        }
        return out
      })
    })

    return <span className="whitespace-pre-wrap">{result}</span>
  }

  return (
    <>
      {/* ── Panel body ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          width: open ? '20rem' : '52px',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border-subtle)',
        }}
      >
        {!open ? (
          /* ── Collapsed state ──────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-between px-2 py-3 h-full">
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Expand Sub-Manager panel"
              className="ui-button min-h-9 w-full px-0 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Open
            </button>
            <div className="grid justify-items-center gap-2 text-center">
              <div
                className="text-[9px] font-semibold uppercase tracking-[0.14em] select-none"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  color: 'var(--color-text-muted)',
                }}
              >
                SM Panel
              </div>
              <div
                className="text-[8px] font-medium uppercase tracking-[0.1em] select-none"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  color: 'var(--color-text-muted)',
                  opacity: 0.6,
                }}
              >
                Expand
              </div>
            </div>
          </div>
        ) : (
          /* ── Expanded state ───────────────────────────────────────────── */
          <>
            {/* Header */}
            <div className="shrink-0 px-5 py-4 flex items-center justify-between gap-3"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">Sub-Manager</span>
                <span className="text-xs text-[var(--color-text-muted)]">·</span>
                <span className="text-xs truncate text-[var(--color-text-muted)]">{pageName}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-sm shrink-0 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                title="Collapse Sub-Manager"
              >
                ✕
              </button>
            </div>

            {/* Disconnected — idle */}
            {!connection && !showConsent && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Sub-Manager not connected.</p>
                  <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                    Connect an AI provider to ask questions about the documents and events on this page.
                  </p>
                </div>
                <button
                  onClick={() => setShowConsent(true)}
                  className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  Connect Sub-Manager
                </button>
              </div>
            )}

            {/* Consent form */}
            {!connection && showConsent && (
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
                <div className="rounded-xl px-4 py-4"
                  style={{ background: 'var(--color-badge-warning-bg)', border: '1px solid var(--color-border-warning)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide text-[var(--color-text-warning)]">Before connecting</p>
                  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    Sub-Manager will send the current page context to the selected AI provider.
                    This includes document names, states, audit records, and organizational metadata.
                    If you select an external provider, this data leaves your infrastructure.
                  </p>
                  <p className="text-xs leading-relaxed mt-2 text-[var(--color-text-secondary)]">
                    Only connect if you are authorized to share this information externally.
                    IA Local runs on your own infrastructure and keeps all data local.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Provider</label>
                  <select
                    value={selProvider}
                    onChange={e => handleProviderChange(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)' }}
                  >
                    <optgroup label="Built-in">
                      {Object.keys(PROVIDER_MODELS).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </optgroup>
                    {customProviders.length > 0 && (
                      <optgroup label="Custom">
                        {customProviders.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {LOCAL_PROVIDERS.has(selProvider) ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--color-success)' }} />
                      Local — data stays on your infrastructure
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-warning)' }}>
                      ⚠ External — data is sent to {selProvider}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Model</label>
                  {(LOCAL_PROVIDERS.has(selProvider) || !(selProvider in PROVIDER_MODELS)) ? (
                    <input
                      type="text"
                      value={selModel}
                      onChange={e => setSelModel(e.target.value)}
                      placeholder="e.g. mistral, llama3, phi3"
                      className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none"
                      style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)' }}
                    />
                  ) : (
                    <select
                      value={selModel}
                      onChange={e => setSelModel(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                      style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)' }}
                    >
                      {(PROVIDER_MODELS[selProvider] ?? []).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>

                {LOCAL_PROVIDERS.has(selProvider) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Endpoint</label>
                    <input
                      type="text"
                      value={selEndpoint}
                      onChange={e => setSelEndpoint(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none"
                      style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)' }}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleConnect}
                    disabled={!selProvider || !selModel}
                    className="flex-1 text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 text-white"
                    style={{ background: 'var(--color-accent)' }}
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => setShowConsent(false)}
                    className="flex-1 text-xs py-2.5 rounded-xl transition-colors text-[var(--color-text-secondary)]"
                    style={{ border: '1px solid var(--color-border-default)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Connected */}
            {connection && (
              <>
                {/* Connection badge */}
                <div className="shrink-0 px-5 py-2 flex items-center justify-between gap-2"
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {connection.isLocal ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--color-success)' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-success)' }} />
                        Local
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--color-warning)' }}>
                        ⚠ External
                      </span>
                    )}
                    <span className="text-xs truncate text-[var(--color-text-muted)]">
                      {connection.provider} · {connection.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={handleClearChat}
                      className="text-xs transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                      Clear
                    </button>
                    <button onClick={handleDisconnect}
                      className="text-xs transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Context indicator */}
                {contextStatus && (
                  <div className="shrink-0 px-5 py-1.5"
                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {contextStatus === 'filtered' ? (
                      <p className="text-xs text-[var(--color-text-warning)]">
                        🔍 Searching within filtered results only
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        🔍 Searching all documents
                      </p>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
                  {messages.length === 0 && !streaming && (
                    <p className="text-xs text-center mt-8 text-[var(--color-text-muted)]">
                      Ask anything about the {pageName.toLowerCase()} context.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'text-white'
                          : 'text-[var(--color-text-primary)]'
                      }`}
                        style={{
                          background: m.role === 'user'
                            ? 'var(--color-accent)'
                            : 'var(--color-surface-soft)',
                          border: m.role === 'user' ? 'none' : '1px solid var(--color-border-subtle)',
                        }}
                      >
                        {m.role === 'assistant' ? renderAssistantMessage(m.content) : m.content}
                      </div>
                    </div>
                  ))}
                  {streaming && streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed text-[var(--color-text-primary)]"
                        style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border-subtle)' }}>
                        {renderAssistantMessage(streamingContent)}
                        <span className="inline-block w-1 h-3 animate-pulse ml-0.5 align-middle bg-[var(--color-text-muted)]" />
                      </div>
                    </div>
                  )}
                  {streaming && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                        Thinking…
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="text-xs rounded-xl px-3 py-2"
                      style={{
                        color: 'var(--color-danger)',
                        background: 'var(--color-danger-soft)',
                        border: '1px solid rgba(180,35,24,0.22)',
                      }}>
                      {error}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div className="flex gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                      }}
                      placeholder="Ask about documents or events…"
                      rows={2}
                      className="flex-1 rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none resize-none transition-colors"
                      style={{
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || streaming}
                      className="self-end text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-40 text-white"
                      style={{ background: 'var(--color-accent)' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── DividerRail ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'Collapse Sub-Manager panel' : 'Expand Sub-Manager panel'}
        className="w-2 shrink-0 flex items-center justify-center transition-colors group"
        style={{
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          cursor: 'col-resize',
        }}
      >
        <span
          className="text-[8px] select-none transition-colors"
          style={{ color: 'var(--color-border-heavy)' }}
        >
          ⋮
        </span>
      </button>

      {/* Disambiguation modal */}
      {disambigResults && (
        <SMDisambiguationModal
          results={disambigResults}
          onSelect={(id) => { onSelectCheckpoint?.(id); setDisambigResults(null) }}
          onClose={() => setDisambigResults(null)}
        />
      )}
    </>
  )
}
