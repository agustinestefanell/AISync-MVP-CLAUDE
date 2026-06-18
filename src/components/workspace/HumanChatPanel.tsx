'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HumanMessage } from '@/lib/db/types'

interface Props {
  connectionId: string
  currentUserId: string
  otherUserEmail: string
  otherUserName?: string
  initialMessages: HumanMessage[]
  onSelectionChange?: (count: number) => void
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

export default function HumanChatPanel({
  connectionId,
  currentUserId,
  otherUserEmail,
  otherUserName,
  initialMessages,
  onSelectionChange,
}: Props) {
  const [messages, setMessages] = useState<HumanMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`human-chat-${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'human_messages',
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          const newMessage = payload.new as HumanMessage
          setMessages((prev) => [...prev, newMessage])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      )
      .subscribe()

    return () => {
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
    if (!input.trim() || sending) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/human-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, content: input.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to send message')
        return
      }

      setInput('')
      // Auto-resize textarea back to default
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      setError('Network error')
      console.error('Failed to send human message:', err)
    } finally {
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

  // Group messages by day
  const messagesByDay: { day: string; messages: Array<{ message: HumanMessage; index: number }> }[] = []
  let lastDay = ''

  messages.forEach((msg, index) => {
    const day = formatDayMarker(new Date(msg.created_at))
    if (day !== lastDay) {
      messagesByDay.push({ day, messages: [] })
      lastDay = day
    }
    messagesByDay[messagesByDay.length - 1].messages.push({ message: msg, index })
  })

  const displayName = otherUserName || otherUserEmail

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">
          Chat with {displayName}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Direct human-to-human communication</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messagesByDay.map((group) => (
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
                        {isMe ? 'You' : displayName}
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
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={sending}
            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 transition-colors disabled:opacity-50 min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
