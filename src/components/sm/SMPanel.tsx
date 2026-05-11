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
const LS_KEY      = 'sm-connection'
const LS_MSGS_KEY = 'sm-messages'

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
  pageContext:         string
  pageName:            string
  customProviders?:    CustomProvider[]
  checkpoints?:        SMCheckpoint[]
  onSelectCheckpoint?: (id: string) => void
}

export default function SMPanel({
  pageContext,
  pageName,
  customProviders = [],
  checkpoints = [],
  onSelectCheckpoint,
}: Props) {
  const [open,        setOpen]        = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [connection,  setConnection]  = useState<Connection | null>(null)

  const [selProvider, setSelProvider] = useState('IA Local')
  const [selModel,    setSelModel]    = useState('mistral')
  const [selEndpoint, setSelEndpoint] = useState('http://localhost:11434/v1')

  const [messages,         setMessages]         = useState<ChatMessage[]>([])
  const [input,            setInput]            = useState('')
  const [streaming,        setStreaming]         = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error,            setError]            = useState<string | null>(null)
  const [disambigResults,  setDisambigResults]  = useState<SMCheckpoint[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const contextStatus = useMemo(() => {
    const firstLine = pageContext.split('\n')[0] ?? ''
    if (firstLine.includes('FILTERED')) return 'filtered' as const
    if (firstLine.includes('FULL'))     return 'full'     as const
    return null
  }, [pageContext])

  // Restore connection and messages from localStorage on mount
  useEffect(() => {
    try {
      const savedConn = localStorage.getItem(LS_KEY)
      if (savedConn) {
        const { provider, model, endpoint } = JSON.parse(savedConn) as {
          provider: string; model: string; endpoint: string
        }
        const isLocal = LOCAL_PROVIDERS.has(provider)
        setConnection({ provider, model, endpoint: endpoint ?? '', isLocal })
        setOpen(true)
      }
      const savedMsgs = localStorage.getItem(LS_MSGS_KEY)
      if (savedMsgs) {
        setMessages(JSON.parse(savedMsgs) as ChatMessage[])
      }
    } catch {}
  }, [])

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(LS_MSGS_KEY, JSON.stringify(messages))
  }, [messages])

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleConnect() {
    const isLocal = LOCAL_PROVIDERS.has(selProvider)
    const conn: Connection = { provider: selProvider, model: selModel, endpoint: selEndpoint, isLocal }
    setConnection(conn)
    setShowConsent(false)
    setError(null)
    localStorage.setItem(LS_KEY, JSON.stringify({
      provider: selProvider,
      model:    selModel,
      endpoint: selEndpoint,
    }))
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
          messages:    nextMessages,
          pageContext,
          pageName,
          provider:    connection.provider,
          model:       connection.model,
          endpoint:    connection.endpoint,
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

    // Multiple matches → single disambiguation button
    if (matched.length > 1) {
      return (
        <span className="whitespace-pre-wrap">
          {text}
          {'\n'}
          <button
            onClick={() => setDisambigResults(matched)}
            className="inline-block mt-1 text-blue-400 underline cursor-pointer hover:text-blue-300 transition-colors"
          >
            View {matched.length} results →
          </button>
        </span>
      )
    }

    // No match → plain text
    if (matched.length === 0) return <span className="whitespace-pre-wrap">{text}</span>

    // Exactly 1 match → inline buttons for each occurrence
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
    <div
      className={`shrink-0 flex flex-col border-r border-gray-800 transition-all duration-200 ease-in-out overflow-hidden ${
        open ? 'w-80 bg-gray-950 shadow-2xl' : 'w-9 bg-gray-900'
      }`}
    >
      {!open ? (
        /* Collapsed tab */
        <div
          onClick={() => setOpen(true)}
          className="flex-1 flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors group"
          title="Open Sub-Manager"
        >
          <span
            className="text-xs font-semibold text-gray-500 group-hover:text-gray-300 transition-colors select-none"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
          >
            Sub-Manager
          </span>
        </div>
      ) : (
        /* Expanded panel */
        <>
          {/* Header */}
          <div className="shrink-0 px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-white">Sub-Manager</span>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-500 truncate">{pageName}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 hover:text-gray-300 text-sm shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Disconnected — idle */}
          {!connection && !showConsent && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-white mb-1">Sub-Manager is not connected.</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Connect an AI provider to ask questions about the documents and events on this page.
                </p>
              </div>
              <button
                onClick={() => setShowConsent(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Connect Sub-Manager
              </button>
            </div>
          )}

          {/* Consent form */}
          {!connection && showConsent && (
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              <div className="bg-yellow-950/40 border border-yellow-900/60 rounded-xl px-4 py-4">
                <p className="text-xs font-semibold text-yellow-400 mb-2 uppercase tracking-wide">Before connecting</p>
                <p className="text-xs text-yellow-200/80 leading-relaxed">
                  Sub-Manager will send the current page context to the selected AI provider. This includes
                  document names, states, audit records, and organizational metadata. If you select an
                  external provider (Anthropic, OpenAI, Google), this data leaves your infrastructure.
                </p>
                <p className="text-xs text-yellow-200/80 leading-relaxed mt-2">
                  Only connect if you are authorized to share this information externally.
                  IA Local runs on your own infrastructure and keeps all data local.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</label>
                <select
                  value={selProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Local — data stays on your infrastructure
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                    ⚠ External — data is sent to {selProvider}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</label>
                {(LOCAL_PROVIDERS.has(selProvider) || !(selProvider in PROVIDER_MODELS)) ? (
                  <input
                    type="text"
                    value={selModel}
                    onChange={e => setSelModel(e.target.value)}
                    placeholder="e.g. mistral, llama3, phi3"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                ) : (
                  <select
                    value={selModel}
                    onChange={e => setSelModel(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {(PROVIDER_MODELS[selProvider] ?? []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>

              {LOCAL_PROVIDERS.has(selProvider) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Endpoint</label>
                  <input
                    type="text"
                    value={selEndpoint}
                    onChange={e => setSelEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleConnect}
                  disabled={!selProvider || !selModel}
                  className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Connect
                </button>
                <button
                  onClick={() => setShowConsent(false)}
                  className="flex-1 text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 py-2.5 rounded-xl transition-colors"
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
              <div className="shrink-0 px-5 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {connection.isLocal ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      Local
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400 font-medium">
                      ⚠ External
                    </span>
                  )}
                  <span className="text-xs text-gray-600 truncate">{connection.provider} · {connection.model}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleClearChat}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Context indicator */}
              {contextStatus && (
                <div className="shrink-0 px-5 py-1.5 border-b border-gray-800/60">
                  {contextStatus === 'filtered' ? (
                    <p className="text-xs text-amber-400">🔍 Searching within filtered results only</p>
                  ) : (
                    <p className="text-xs text-gray-600">🔍 Searching all documents</p>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && !streaming && (
                  <p className="text-xs text-gray-700 text-center mt-8">
                    Ask anything about the {pageName.toLowerCase()} context.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      {m.role === 'assistant' ? renderAssistantMessage(m.content) : m.content}
                    </div>
                  </div>
                ))}
                {streaming && streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-gray-800 text-gray-200">
                      {renderAssistantMessage(streamingContent)}
                      <span className="inline-block w-1 h-3 bg-gray-400 animate-pulse ml-0.5 align-middle" />
                    </div>
                  </div>
                )}
                {streaming && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 text-xs text-gray-600">Thinking…</div>
                  </div>
                )}
                {error && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 py-3 border-t border-gray-800">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Ask about documents or events…"
                    rows={2}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || streaming}
                    className="self-end text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Disambiguation modal — fixed overlay, breaks out of panel */}
      {disambigResults && (
        <SMDisambiguationModal
          results={disambigResults}
          onSelect={(id) => {
            onSelectCheckpoint?.(id)
            setDisambigResults(null)
          }}
          onClose={() => setDisambigResults(null)}
        />
      )}
    </div>
  )
}
