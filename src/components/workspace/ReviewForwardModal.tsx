'use client'

import { useState, useEffect } from 'react'

interface Props {
  open:    boolean
  onCancel: () => void
  onSend:   (instructions: string) => void
}

// Compartido por AgentPanel.tsx (Agent→Agent, Agent→Human chat) y
// HumanChatPanel.tsx (Human chat→Agent) — mismo copy y comportamiento en
// las 3 variantes de Review & Forward, ver handoff-2026-07-c.md 2026-08-26.
export default function ReviewForwardModal({ open, onCancel, onSend }: Props) {
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    if (open) setInstructions('')
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Instructions?</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Optional — add context for the recipient before forwarding.</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-[var(--color-text-primary)] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <textarea
            autoFocus
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="e.g. Please review section 3 before responding"
            rows={4}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(instructions.trim())}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
