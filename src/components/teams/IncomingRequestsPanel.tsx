'use client'

import { useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { Connection } from './ConnectTeamModal'

interface IncomingRequestsPanelProps {
  connections: Connection[]
  myTeams: TeamWithWorkspaces[] // no longer used (isolated team is created automatically)
  projectId: string
  projects: Array<{ id: string; name: string }>
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
  myTeams: _myTeams,
  projectId,
  projects,
  onClose,
  onAccepted,
  onRejected,
}: IncomingRequestsPanelProps) {
  const pending = connections.filter(c => c.status === 'pending' && c.direction === 'incoming')

  const [acceptingId, setAcceptingId]   = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId)
  const [loading, setLoading]           = useState<string | null>(null)
  const [error, setError]               = useState('')

  async function handleAccept(conn: Connection) {
    setLoading(conn.id)
    setError('')
    try {
      const res = await fetch(`/api/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          receiver_project_id: selectedProjectId,
        }),
      })
      if (!res.ok) {
        const d = await res.json()

        // Handle connection limit case (403 Forbidden)
        if (res.status === 403 && d.error === 'Connection limit reached') {
          setError(d.message ?? 'Connection limit reached.')
          setLoading(null)
          return
        }

        // Handle existing connection case (409 Conflict) - should not happen in practice
        if (res.status === 409 && d.error === 'existing_connection') {
          setError(d.message ?? 'An active connection already exists between these accounts.')
          setLoading(null)
          return
        }

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
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Connection requests</h3>
            {pending.length > 0 && (
              <p className="text-xs text-indigo-600 mt-0.5">{pending.length} pending</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-sm px-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {pending.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">No pending requests.</p>
          )}

          {pending.map(conn => (
            <div
              key={conn.id}
              className="border border-indigo-200 bg-indigo-50 rounded-xl px-4 py-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{conn.requester_email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    wants to connect <span className="text-gray-600">{conn.requester_team_name}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5" suppressHydrationWarning>
                    {formatDate(conn.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                    {conn.connection_type}
                  </span>
                </div>
              </div>

              {acceptingId === conn.id ? (
                <div className="space-y-2 pt-1 border-t border-gray-200">
                  <p className="text-xs text-gray-500">A shared workspace will be created automatically when you accept.</p>

                  {projects.length > 1 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Your Project <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(e.target.value)}
                        className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-indigo-300 transition-colors"
                      >
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">Choose which of your projects will contain this shared team.</p>
                    </div>
                  )}

                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(conn)}
                      disabled={!!loading}
                      className="flex-1 text-xs bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-700 border border-emerald-200 font-semibold py-2 rounded-lg transition-colors"
                    >
                      {loading === conn.id ? 'Accepting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setAcceptingId(null)}
                      className="text-xs text-gray-500 hover:text-gray-600 px-3 py-2 border border-gray-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAcceptingId(conn.id)
                      setSelectedProjectId(projectId) // Reset to default Project
                      setError('')
                    }}
                    className="flex-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold py-1.5 rounded-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(conn.id)}
                    disabled={!!loading}
                    className="flex-1 text-xs border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 py-1.5 rounded-lg transition-colors"
                  >
                    {loading === conn.id ? '…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
