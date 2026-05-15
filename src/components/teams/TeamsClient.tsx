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
  const [zoomIn, setZoomIn]   = useState(0)
  const [zoomOut, setZoomOut] = useState(0)
  const [zoomReset, setZoomReset] = useState(0)

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

  // Team / Worker counts for ribbon
  const workerCount = teams.reduce((sum, t) => {
    const ws = t.workspaces[0]
    if (!ws) return sum
    return sum + (ws.agent_sessions ?? []).filter(a => a.agent_role !== 'manager').length
  }, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Ribbon ───────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 grid items-center gap-3 px-4 py-3
          sm:grid-cols-[auto_1fr_auto]"
        style={{
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          background: 'linear-gradient(180deg, rgba(250,252,254,0.98) 0%, rgba(240,245,249,0.98) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 12px rgba(15,23,42,0.05)',
        }}
      >
        {/* Column 1 — Title */}
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold uppercase tracking-[0.10em] text-neutral-900 leading-none">
            Teams Map
          </h1>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500" style={{ fontVariant: 'small-caps' }}>
            Operational Elasticity View
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5">
            <button className="text-left text-[11px] leading-4 text-teal-600 hover:underline underline-offset-2">
              How to use Teams Map
            </button>
            <button className="text-left text-[11px] leading-4 text-teal-600 hover:underline underline-offset-2">
              How to create Teams
            </button>
          </div>
        </div>

        {/* Column 2 — spacer */}
        <div className="hidden sm:block" />

        {/* Column 3 — Controls + SAT/MAT at far right */}
        <div className="flex flex-wrap items-center justify-end gap-2">

          {/* Map / Tree toggle */}
          <div
            className="flex rounded-full border p-1"
            style={{ borderColor: 'rgba(15,23,42,0.12)', background: 'rgba(255,255,255,0.86)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)' }}
          >
            {(['map', 'tree'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === mode ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
                onClick={() => setView(mode)}
              >
                {mode === 'map' ? 'Map' : 'Tree'}
              </button>
            ))}
          </div>

          {/* Teams / Workers count */}
          <div
            className="rounded-[10px] border px-3 py-2 text-xs text-neutral-700"
            style={{ borderColor: 'rgba(15,23,42,0.10)', background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,247,250,0.95) 100%)' }}
          >
            Teams {teams.length} / Workers {workerCount}
          </div>

          {/* Zoom buttons */}
          <div
            className="flex items-center gap-1 rounded-full border p-1"
            style={{ borderColor: 'rgba(15,23,42,0.12)', background: 'rgba(255,255,255,0.86)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)' }}
          >
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              title="Zoom In"
              onClick={() => setZoomIn(n => n + 1)}
            >+</button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              title="Zoom Out"
              onClick={() => setZoomOut(n => n + 1)}
            >−</button>
            <button
              className="h-8 rounded-full px-3 text-xs text-neutral-700 hover:bg-neutral-100"
              onClick={() => setZoomReset(n => n + 1)}
            >Reset</button>
          </div>

          {/* Requests */}
          <button
            onClick={() => setShowIncoming(true)}
            className="relative flex h-9 items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 text-xs text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
          >
            Requests
            {incomingPending > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold leading-none text-white">
                {incomingPending}
              </span>
            )}
          </button>

          {/* Connect */}
          <button
            onClick={() => setShowConnect(true)}
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-teal-200 bg-teal-50 px-3 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
          >
            ↔ Connect
          </button>

          {/* Add Team */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex h-9 items-center gap-1.5 rounded-[10px] bg-neutral-900 px-4 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            + Add Team
          </button>

          {/* Separator */}
          <div className="hidden sm:block h-8 w-px bg-neutral-200 mx-1" />

          {/* SAT/MAT legend */}
          <div
            className="shrink-0 rounded-[12px] border px-3 py-2 text-[11px] leading-[1.5] text-neutral-600"
            style={{
              borderColor: 'rgba(15,23,42,0.10)',
              background: 'rgba(255,255,255,0.88)',
            }}
          >
            <div>SAT = Single Agent Team</div>
            <div>MAT = Multiple Agent Team</div>
            <button className="mt-0.5 text-[10px] text-teal-600 hover:underline underline-offset-2">
              Differences and uses
            </button>
          </div>
        </div>
      </div>

      {/* Main view */}
      <div className="flex-1 min-h-0 relative">
        {view === 'map' ? (
          <MapView
            teams={teams}
            projectId={projectId}
            activeProjectId={projectId}
            connectedTeamIds={connectedTeamIds}
            externalConnections={externalConnections}
            zoomInSignal={zoomIn}
            zoomOutSignal={zoomOut}
            resetSignal={zoomReset}
            onEdit={teamId => {
              const team = teams.find(t => t.id === teamId)
              if (team) setEditingTeam(team)
            }}
            onConnect={() => setShowConnect(true)}
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
