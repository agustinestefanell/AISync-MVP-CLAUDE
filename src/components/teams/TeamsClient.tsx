'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import TreeView from './TreeView'
import AddTeamModal from './AddTeamModal'
import EditTeamModal from './EditTeamModal'
import ConnectTeamModal, { type Connection } from './ConnectTeamModal'
import IncomingRequestsPanel from './IncomingRequestsPanel'
import type { TeamWithWorkspaces } from '@/lib/db/types'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

type ViewMode = 'map' | 'tree'

export interface ExternalConnection {
  connectionId: string
  myTeamId: string
  externalTeamId: string | null
  externalTeamName: string
  externalEmail: string
}

interface TeamsClientProps {
  projectId: string
  initialTeams: TeamWithWorkspaces[]
}

export default function TeamsClient({ projectId, initialTeams }: TeamsClientProps) {
  const [teams, setTeams]             = useState<TeamWithWorkspaces[]>(initialTeams)
  const [connections, setConnections] = useState<Connection[]>([])
  const [view, setView]               = useState<ViewMode>('map')
  const [showAdd, setShowAdd]         = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [showIncoming, setShowIncoming] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamWithWorkspaces | null>(null)

  const fetchConnections = useCallback(async () => {
    try {
      const r = await fetch('/api/connections')
      const data = await r.json()
      setConnections(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchConnections()

    const supabase = createClient()
    const channel = supabase
      .channel('team-connections-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_connections' }, () => {
        fetchConnections()
      })
      .subscribe()

    // Fallback polling every 15 s in case realtime misses cross-account events
    const poll = setInterval(fetchConnections, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchConnections])

  function handleCreated(team: TeamWithWorkspaces) {
    setTeams(prev => [...prev, team])
    setShowAdd(false)
  }

  function handleUpdated(updated: TeamWithWorkspaces) {
    setTeams(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditingTeam(null)
  }

  function handleDeleted(teamId: string) {
    setTeams(prev => prev.filter(t => t.id !== teamId))
    setEditingTeam(null)
  }

  function handleConnected(conn: Connection) {
    setConnections(prev => [conn, ...prev])
    setShowConnect(false)
  }

  function handleAccepted(updated: Connection) {
    setConnections(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  function handleRejected(id: string) {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'rejected' } : c
    ))
  }

  // My local teams that have at least one active connection
  const connectedTeamIds = new Set(
    connections
      .filter(c => c.status === 'active')
      .map(c => c.direction === 'outgoing' ? c.requester_team_id : c.receiver_team_id)
      .filter((id): id is string => !!id)
  )

  // External teams to render as separate nodes in map / tree
  const externalConnections: ExternalConnection[] = connections
    .filter(c => c.status === 'active')
    .map(c => c.direction === 'outgoing'
      ? {
          connectionId:     c.id,
          myTeamId:         c.requester_team_id,
          externalTeamId:   c.receiver_team_id,
          externalTeamName: c.receiver_team_name ?? '—',
          externalEmail:    c.receiver_email,
        }
      : {
          connectionId:     c.id,
          myTeamId:         c.receiver_team_id ?? '',
          externalTeamId:   c.requester_team_id,
          externalTeamName: c.requester_team_name,
          externalEmail:    c.requester_email,
        }
    )
    .filter(ec => !!ec.myTeamId)

  const incomingPending = connections.filter(
    c => c.direction === 'incoming' && c.status === 'pending'
  ).length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center gap-3">
        {/* View toggle */}
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setView('map')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              view === 'map' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            MAP
          </button>
          <button
            onClick={() => setView('tree')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              view === 'tree' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            TREE
          </button>
        </div>

        <span className="text-xs text-gray-700">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>

        <div className="flex-1" />

        {/* Requests — always visible */}
        <button
          onClick={() => setShowIncoming(true)}
          className="relative flex items-center gap-1.5 text-xs text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-200 px-3 py-2 rounded-lg transition-colors"
        >
          <span>Requests</span>
          {incomingPending > 0 && (
            <span className="bg-indigo-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {incomingPending}
            </span>
          )}
        </button>

        {/* Connect Team */}
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 text-xs text-teal-300 border border-teal-800 hover:border-teal-600 px-4 py-2 rounded-lg transition-colors"
        >
          ↔ Connect
        </button>

        {/* Add Team */}
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Add Team
        </button>
      </div>

      {/* Main view */}
      <div className="flex-1 min-h-0 relative">
        {view === 'map' ? (
          <MapView
            teams={teams}
            projectId={projectId}
            connectedTeamIds={connectedTeamIds}
            externalConnections={externalConnections}
            onEdit={teamId => {
              const team = teams.find(t => t.id === teamId)
              if (team) setEditingTeam(team)
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-6">
            <TreeView
              teams={teams}
              connectedTeamIds={connectedTeamIds}
              externalConnections={externalConnections}
              onEdit={t => setEditingTeam(t)}
              onDelete={t => setEditingTeam(t)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddTeamModal
          projectId={projectId}
          teams={teams}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          allTeams={teams}
          onClose={() => setEditingTeam(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {showConnect && (
        <ConnectTeamModal
          teams={teams}
          onClose={() => setShowConnect(false)}
          onConnected={handleConnected}
        />
      )}

      {showIncoming && (
        <IncomingRequestsPanel
          connections={connections}
          myTeams={teams}
          onClose={() => setShowIncoming(false)}
          onAccepted={handleAccepted}
          onRejected={handleRejected}
        />
      )}
    </div>
  )
}
