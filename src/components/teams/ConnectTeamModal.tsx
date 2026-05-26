'use client'

import { useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'

interface ConnectTeamModalProps {
  teams: TeamWithWorkspaces[]
  onClose: () => void
  onConnected: (connection: Connection) => void
}

export interface Connection {
  id: string
  requester_account_id: string
  requester_email: string
  requester_team_id: string
  requester_team_name: string
  receiver_email: string
  receiver_account_id: string | null
  receiver_team_id: string | null
  receiver_team_name: string | null
  connection_type: string
  scope: string
  status: string
  direction: 'outgoing' | 'incoming'
  created_at: string
  updated_at: string
}

export default function ConnectTeamModal({ teams, onClose, onConnected }: ConnectTeamModalProps) {
  const [hostTeamId, setHostTeamId] = useState(teams[0]?.id ?? '')
  const [receiverEmail, setReceiverEmail] = useState('')
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const hostTeam = teams.find(t => t.id === hostTeamId)

  async function handleSubmit() {
    if (!hostTeamId) { setError('Select a host team.'); return }
    if (!receiverEmail.trim()) { setError('Enter the external account email.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail.trim())) {
      setError('Invalid email.'); return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_team_id:   hostTeamId,
          requester_team_name: hostTeam?.name ?? '',
          receiver_email:      receiverEmail.trim(),
          connection_type:     'project-bound',
          scope:               'no-shared-repo',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error sending request.')
        return
      }
      onConnected(await res.json())
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Connect Team</h3>
            <p className="text-xs text-gray-500 mt-0.5">Connect with a team from another AISync account</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-sm px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Host team */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Your host team (outgoing SM)
            </label>
            <select
              value={hostTeamId}
              onChange={e => setHostTeamId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Receiver email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              External account email
            </label>
            <input
              autoFocus
              type="email"
              value={receiverEmail}
              onChange={e => setReceiverEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="other@company.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Connection type</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 bg-indigo-950/40 border border-indigo-800 rounded-xl px-4 py-3 cursor-pointer">
                <input type="radio" checked readOnly className="mt-0.5 accent-indigo-500" />
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Project-bound</p>
                  <p className="text-xs text-gray-500 mt-0.5">Bound to the active project. SM↔SM channel operational.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 bg-gray-50/40 border border-gray-200/50 rounded-xl px-4 py-3 opacity-40 cursor-not-allowed">
                <input type="radio" disabled className="mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">Persistent partner
                    <span className="ml-2 text-xs text-gray-600 font-normal">coming soon</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Permanent connection between organizations.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Scope</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 bg-gray-50/60 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer">
                <input type="radio" checked readOnly className="mt-0.5 accent-indigo-500" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">No shared repository</p>
                  <p className="text-xs text-gray-500 mt-0.5">Message exchange between SMs, no repository access.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 bg-gray-50/40 border border-gray-200/50 rounded-xl px-4 py-3 opacity-40 cursor-not-allowed">
                <input type="radio" disabled className="mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">Shared project repository
                    <span className="ml-2 text-xs text-gray-600 font-normal">coming soon</span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-800 px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  )
}
