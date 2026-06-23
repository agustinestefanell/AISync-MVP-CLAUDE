'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HumanMessage } from '@/lib/db/types'

// ── Public interface ─────────────────────────────────────────────────────────
export interface HumanChatPanelHandle {
  getAllMessages(): HumanMessage[]
  getSelectedMessages(): HumanMessage[]
  clearSelection(): void
}

interface Props {
  connectionId: string
  currentUserId: string
  otherUserEmail: string
  otherUserName?: string
  initialMessages: HumanMessage[]
  onSelectionChange?: (count: number) => void
  onSaveVersion?: () => void
  onOpenSaveSelection?: () => void
  forwardTargets?: { role: string; label: string }[]
  onForward?: (messages: HumanMessage[], targetRole: string) => void
  workspaceLocked?: boolean
  connectionStatus?: string
}

// Day marker helper
function formatDayMarker(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const HumanChatPanel = forwardRef<HumanChatPanelHandle, Props>(function HumanChatPanel({
  connectionId,
  currentUserId,
  otherUserEmail,
  otherUserName: _otherUserName, // Unused - header now shows email only
  initialMessages,
  onSelectionChange,
  onSaveVersion,
  onOpenSaveSelection,
  forwardTargets,
  onForward,
  workspaceLocked = false,
  connectionStatus,
}, ref) {
  const [messages, setMessages] = useState<HumanMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isMounted, setIsMounted] = useState(false)
  const [forwardTarget, setForwardTarget] = useState(forwardTargets?.[0]?.role ?? '')
  const [localConnectionInactive, setLocalConnectionInactive] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasSelection = selectedIndices.size > 0

  // Banner superior: solo para conexiones ya inactivas desde server
  const shouldShowInactiveConnectionBanner = !!(
    connectionStatus &&
    ['cancelled', 'disconnected'].includes(connectionStatus)
  )

  // Input disabled: ambos casos (server inactive + client-detected inactive)
  const isConnectionNoLongerActive = shouldShowInactiveConnectionBanner || localConnectionInactive

  // Expose public methods via ref
  useImperativeHandle(ref, () => ({
    getAllMessages: () => messages,
    getSelectedMessages: () => {
      const indices = Array.from(selectedIndices).sort((a, b) => a - b)
      return indices.map(i => messages[i]).filter(Boolean)
    },
    clearSelection: () => {
      setSelectedIndices(new Set())
    },
  }), [messages, selectedIndices])

  // Detect client-side mount to avoid hydration errors with date formatting
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Realtime subscription
  useEffect(() => {
    let isMounted = true
    const supabase = createClient()
    const channel = supabase
      .channel(`human-chat-${connectionId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'human_messages',
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          console.log('[HumanChat] Realtime INSERT received:', payload.new)
          const newMessage = payload.new as HumanMessage

          // Deduplicate: only add if message ID doesn't exist
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) {
              console.log('[HumanChat] Message already exists, skipping:', newMessage.id)
              return prev
            }
            console.log('[HumanChat] Adding new message from Realtime:', newMessage.id)
            return [...prev, newMessage]
          })

          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      )
      .subscribe(async (status, err) => {
        console.log('[HumanChat] Subscription status:', status, err)
        if (status === 'SUBSCRIBED') {
          console.log('[HumanChat] Successfully subscribed to human_messages')

          // Refetch messages once to close the T0→T1 gap (SSR initial load → Realtime subscription)
          console.log('[HumanChat] Refetching messages to catch any inserted during subscription setup...')
          try {
            const { data: refetchedMessages, error: refetchError } = await supabase
              .from('human_messages')
              .select('*')
              .eq('connection_id', connectionId)
              .order('created_at', { ascending: true })

            if (refetchError) {
              console.error('[HumanChat] Refetch error:', refetchError)
            } else if (refetchedMessages && isMounted) {
              console.log('[HumanChat] Refetched', refetchedMessages.length, 'messages')
              // Merge with existing messages, deduplicating by message.id
              setMessages((current) => {
                const byId = new Map(current.map((msg) => [msg.id, msg]))
                for (const msg of refetchedMessages as HumanMessage[]) {
                  byId.set(msg.id, msg)
                }
                const merged = Array.from(byId.values()).sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
                console.log('[HumanChat] Merged state:', merged.length, 'messages')
                return merged
              })
            }
          } catch (err) {
            console.error('[HumanChat] Refetch exception:', err)
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[HumanChat] Channel error:', err)
        } else if (status === 'TIMED_OUT') {
          console.warn('[HumanChat] Subscription timed out, will retry...')
        } else if (status === 'CLOSED') {
          console.warn('[HumanChat] Channel closed')
        }
      })

    return () => {
      isMounted = false
      console.log('[HumanChat] Unsubscribing from channel')
      supabase.removeChannel(channel)
    }
  }, [connectionId])

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIndices.size)
  }, [selectedIndices.size, onSelectionChange])

  // Scroll to bottom on mount
  useEffect(() => {
    if (initialMessages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    console.log('[HumanChat] handleSend called, input:', input.trim())
    if (!input.trim() || sending) {
      console.log('[HumanChat] handleSend aborted - empty input or already sending')
      return
    }

    setSending(true)
    setError(null)
    console.log('[HumanChat] Starting POST to /api/human-chat')

    try {
      const res = await fetch('/api/human-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, content: input.trim() }),
      })

      console.log('[HumanChat] POST response status:', res.status, res.ok)

      if (!res.ok) {
        const data = await res.json()
        console.error('[HumanChat] POST failed:', data)

        // Check for inactive connection error with strict validation (status + text)
        if (res.status === 404 && data.error?.includes('Connection not found or not active')) {
          // Set local inactive state - will show composer-level notice, not duplicate banner
          setLocalConnectionInactive(true)
          setError(null) // Clear any previous error
        } else {
          setError(data.error ?? 'Failed to send message')
        }
        return
      }

      // Optimistic update: add sent message to local state immediately
      console.log('[HumanChat] Parsing response JSON...')
      const sentMessage = await res.json() as HumanMessage
      console.log('[HumanChat] Received sentMessage:', sentMessage)

      console.log('[HumanChat] Current messages state before update:', messages.length)
      setMessages(prev => {
        const updated = [...prev, sentMessage]
        console.log('[HumanChat] Updated messages state:', updated.length, updated)
        return updated
      })

      setInput('')
      // Auto-resize textarea back to default
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      // Scroll to bottom to show new message
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      setError('Network error')
      console.error('[HumanChat] Exception in handleSend:', err)
    } finally {
      console.log('[HumanChat] handleSend finally block - setting sending to false')
      setSending(false)
    }
  }

  function toggleSelection(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function handleForward() {
    if (!onForward || !hasSelection) return
    const indices = Array.from(selectedIndices).sort((a, b) => a - b)
    const selected = indices.map(i => messages[i]).filter(Boolean)
    onForward(selected, forwardTarget)
    setSelectedIndices(new Set())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // Group messages by day (only on client to avoid hydration errors)
  console.log('[HumanChat] Rendering with messages:', messages.length, messages)
  const messagesByDay: { day: string; messages: Array<{ message: HumanMessage; index: number }> }[] = []

  if (isMounted) {
    let lastDay = ''
    messages.forEach((msg, index) => {
      const day = formatDayMarker(new Date(msg.created_at))
      if (day !== lastDay) {
        messagesByDay.push({ day, messages: [] })
        lastDay = day
      }
      messagesByDay[messagesByDay.length - 1].messages.push({ message: msg, index })
    })
  }

  console.log('[HumanChat] messagesByDay:', messagesByDay)

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">
          Chat with {otherUserEmail}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Direct human-to-human communication</p>
      </div>

      {/* Inactive connection banner - only for server-known inactive connections */}
      {shouldShowInactiveConnectionBanner && (
        <div className="shrink-0 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
          <p className="text-xs text-amber-800 font-medium">
            This connection is no longer active.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!isMounted ? (
          // SSR placeholder to avoid hydration errors
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading messages...
          </div>
        ) : (
          messagesByDay.map((group) => (
            <div key={group.day}>
              {/* Day marker */}
              <div className="flex items-center justify-center my-4">
                <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                  {group.day}
                </div>
              </div>

              {/* Messages for this day */}
              {group.messages.map(({ message, index }) => {
                const isMe = message.from_account_id === currentUserId
                const isSelected = selectedIndices.has(index)

                return (
                  <div key={message.id} className="flex items-start gap-2 group">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(index)}
                      className="mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    />

                    {/* Message bubble */}
                    <div
                      className={`flex-1 rounded-lg px-3 py-2 ${
                        isMe
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 border border-gray-200'
                      } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          {isMe ? 'You' : otherUserEmail}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatMessageTime(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Composer-level inactive connection notice (client-detected) */}
      {localConnectionInactive && !shouldShowInactiveConnectionBanner && (
        <div className="shrink-0 px-4 py-2 bg-amber-50 border-t border-amber-200">
          <p className="text-xs text-amber-800 font-medium">
            This connection is no longer active.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="ui-chat-input-section shrink-0">
        <div className="ui-chat-composer">
          <textarea
            ref={textareaRef}
            className="ui-chat-composer-input disabled:cursor-not-allowed disabled:opacity-45"
            placeholder={isConnectionNoLongerActive ? "Connection inactive" : "Type your message... (Enter to send, Shift+Enter for new line)"}
            value={input}
            disabled={sending || isConnectionNoLongerActive}
            rows={1}
            style={{ resize: 'none', minHeight: '36px', maxHeight: '96px', overflowY: 'auto' }}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className="ui-button ui-button-primary ui-chat-send text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleSend}
            disabled={!input.trim() || sending || isConnectionNoLongerActive}
          >
            {sending ? '…' : 'Send'}
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
                disabled={!forwardTargets?.length || workspaceLocked || isConnectionNoLongerActive}
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
              disabled={!hasSelection || !onForward || workspaceLocked || isConnectionNoLongerActive}
              title="Review and forward selected messages"
            >
              Review & Forward
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: Actions grid ────────────────────────────────────── */}
      <div className="ui-chat-actions-section shrink-0 px-3 pb-2 pt-1">
        <div className="grid grid-cols-3 gap-1">
          <button
            className="ui-button px-2 text-[11px] disabled:opacity-40"
            style={{ color: 'var(--color-text-secondary)' }}
            disabled={true}
            title="Refresh session (not applicable to human chat)"
          >
            Refresh Session
          </button>
          <button
            className="ui-button px-2 text-[11px] disabled:opacity-40"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={onSaveVersion}
            disabled={!onSaveVersion || messages.length === 0}
            title="Save a checkpoint of this human chat"
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
              ? (selectedIndices.size === 1 ? 'Save Selection (1)' : `Save Selections (${selectedIndices.size})`)
              : 'Save Selection'}
          </button>
        </div>
      </div>
    </div>
  )
})

export default HumanChatPanel
