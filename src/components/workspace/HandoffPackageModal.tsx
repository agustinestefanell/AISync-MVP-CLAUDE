'use client'

import { useState } from 'react'
import type { WorkspaceWithAgents } from '@/lib/db/types'
import type { ChatMessage } from '@/lib/providers/types'

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

interface Props {
  workspace:        WorkspaceWithAgents
  getAgentMessages: (sessionId: string) => ChatMessage[]
  onClose:          () => void
  onCreated:        () => void
}

export default function HandoffPackageModal({ workspace, getAgentMessages, onClose, onCreated }: Props) {
  const sessions = workspace.agent_sessions

  const [name, setName]               = useState('')
  const [nameError, setNameError]     = useState(false)
  const [fromId, setFromId]           = useState(sessions[0]?.id ?? '')
  const [toId, setToId]               = useState(sessions[1]?.id ?? sessions[0]?.id ?? '')
  const [context, setContext]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [apiError, setApiError]       = useState<string | null>(null)
  const [done, setDone]               = useState(false)

  const fromMessages = getAgentMessages(fromId).slice(-10)
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(
    () => new Set(fromMessages.map((_, i) => i))
  )

  function handleFromChange(sessionId: string) {
    setFromId(sessionId)
    const msgs = getAgentMessages(sessionId).slice(-10)
    setSelectedIdx(new Set(msgs.map((_, i) => i)))
  }

  function toggleMsg(i: number) {
    setSelectedIdx(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim()) { setNameError(true); return }

    const fromSession = sessions.find(s => s.id === fromId)
    const toSession   = sessions.find(s => s.id === toId)
    const msgs        = fromMessages.filter((_, i) => selectedIdx.has(i))

    setSaving(true)
    setApiError(null)
    try {
      const res = await fetch('/api/handoff-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          workspaceId: workspace.id,
          fromAgent:   fromSession?.agent_role ?? '',
          toAgent:     toSession?.agent_role ?? '',
          context:     context.trim() || null,
          messages:    msgs,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error creating package')
      }
      setDone(true)
      setTimeout(() => { onCreated(); onClose() }, 1200)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white border border-green-800 rounded-2xl px-8 py-6 text-center shadow-2xl">
          <p className="text-green-400 font-semibold text-sm">Handoff Package created</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-white">Create Handoff Package</h2>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-600">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. Analysis → Implementation handoff"
            className={`w-full bg-gray-50 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors ${
              nameError ? 'border-red-500 focus:border-red-400' : 'border-gray-200 focus:border-purple-500'
            }`}
          />
          {nameError && <p className="text-xs text-red-400">Name is required</p>}
        </div>

        {/* From → To */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-gray-600">From</label>
            <select
              value={fromId}
              onChange={e => handleFromChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500 transition-colors"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{AGENT_LABEL[s.agent_role] ?? s.agent_role}</option>
              ))}
            </select>
          </div>
          <span className="pb-2.5 text-gray-500 text-sm shrink-0">→</span>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-gray-600">To</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500 transition-colors"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{AGENT_LABEL[s.agent_role] ?? s.agent_role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Context */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-600">
            Context <span className="text-gray-600 font-normal">(optional)</span>
          </label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Describe the purpose or context of this handoff…"
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 resize-none transition-colors"
          />
        </div>

        {/* Messages */}
        {fromMessages.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">
              Messages to include{' '}
              <span className="text-gray-600 font-normal">(last {fromMessages.length})</span>
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-700/50">
              {fromMessages.map((msg, i) => (
                <label key={i} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-100/30">
                  <input
                    type="checkbox"
                    checked={selectedIdx.has(i)}
                    onChange={() => toggleMsg(i)}
                    className="mt-0.5 accent-purple-500 shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-indigo-400' : 'text-gray-400'}`}>
                      {msg.role === 'user' ? 'User' : 'Agent'}
                    </span>
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      {msg.content.slice(0, 80)}{msg.content.length > 80 ? '…' : ''}
                    </p>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600">No messages in the selected panel yet.</p>
        )}

        {apiError && (
          <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Create Handoff Package'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
