'use client'

import { useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { Connection } from './ConnectTeamModal'

interface IncomingRequestsPanelProps {
  connections: Connection[]
  myTeams: TeamWithWorkspaces[]
  onClose: () => void
  onAccepted: (updated: Connection) => void
  onRejected: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function IncomingRequestsPanel({
  connections,
  myTeams,
  onClose,
  onAccepted,
  onRejected,
}: IncomingRequestsPanelProps) {
  const pending = connections.filter(c => c.status === 'pending' && c.direction === 'incoming')
  const active  = connections.filter(c => c.status === 'active'  && c.direction === 'incoming')

  const [acceptingId, setAcceptingId]   = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string>(myTeams[0]?.id ?? '')
  const [loading, setLoading]           = useState<string | null>(null)
  const [error, setError]               = useState('')

  async function handleAccept(conn: Connection) {
    if (!selectedTeam) { setError('Select a team to accept.'); return }
    const team = myTeams.find(t => t.id === selectedTeam)
    if (!team) return
    setLoading(conn.id)
    setError('')
    try {
      const res = await fetch(`/api/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          receiver_team_id:   team.id,
          receiver_team_name: team.name,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error accepting.')
        return
      }
      onAccepted(await res.json())
      setAcceptingId(null)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject(id: string) {
    setLoading(id)
    try {
      await fetch(`/api/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      onRejected(id)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Connection requests</h3>
            {pending.length > 0 && (
              <p className="text-xs text-indigo-400 mt-0.5">{pending.length} pending</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm px-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {pending.length === 0 && active.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">No pending requests.</p>
          )}

          {pending.map(conn => (
            <div
              key={conn.id}
              className="border border-indigo-900/60 bg-indigo-950/20 rounded-xl px-4 py-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{conn.requester_email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    wants to connect <span className="text-gray-300">{conn.requester_team_name}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5" suppressHydrationWarning>
                    {formatDate(conn.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full">
                    {conn.connection_type}
                  </span>
                </div>
              </div>

              {acceptingId === conn.id ? (
                <div className="space-y-2 pt-1 border-t border-gray-800">
                  <p className="text-xs text-gray-400">Select your team for this connection:</p>
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(conn)}
                      disabled={!!loading}
                      className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
                    >
                      {loading === conn.id ? 'Accepting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setAcceptingId(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 border border-gray-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAcceptingId(conn.id); setError('') }}
                    className="flex-1 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 font-semibold py-1.5 rounded-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(conn.id)}
                    disabled={!!loading}
                    className="flex-1 text-xs border border-red-900 text-red-500 hover:text-red-400 hover:border-red-700 disabled:opacity-50 py-1.5 rounded-lg transition-colors"
                  >
                    {loading === conn.id ? '…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {active.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 mb-2">Active connections (incoming)</p>
              {active.map(conn => (
                <div key={conn.id} className="flex items-center gap-3 bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{conn.requester_email}</p>
                    <p className="text-xs text-gray-500">
                      {conn.requester_team_name} ↔ {conn.receiver_team_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
