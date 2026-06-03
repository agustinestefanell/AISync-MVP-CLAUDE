'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
import TreeView from './TreeView'
import AddTeamModal from './AddTeamModal'
import EditTeamModal from './EditTeamModal'
import ConnectTeamModal, { type Connection } from './ConnectTeamModal'
import IncomingRequestsPanel from './IncomingRequestsPanel'
import TopRibbon from '@/components/layout/TopRibbon'
import BottomRibbon from '@/components/layout/BottomRibbon'
import type { TeamWithWorkspaces } from '@/lib/db/types'

const TEAMS_GUIDE = `Imagine you have been working for a while and now the structure has grown. There are several teams, managers, workers, and branches, and you want to understand where everything is without getting lost. In that case, you usually start with Tree. Tree gives you a simpler and lighter view of the structure, so you can locate the part you are looking for more quickly. Once you already know where you are and want to inspect that area more clearly, you move to Map. Map shows the same structure in a richer and more detailed way.

Teams Map is the page that helps you understand the internal structure of the system. It shows how the General Manager, the Workers, and additional teams are organized. You do not always need this page as the very first step, but it becomes useful when you want to understand the structure more clearly and work with it more deliberately.

AISync includes two ways to read the same team structure:

→ Tree is the simplified structural view. It helps you locate and read the structure faster, with less visual weight.
→ Map is the richer structural view. It helps you inspect the same structure in a more detailed and visual way.

Use this page when you want to understand how the system is organized, check how teams relate to each other, review the relation between managers and workers, or create and edit teams more consciously.

In practical terms, Teams Map makes the structure of AISync visible. It reminds you that AISync is not only a chat interface. It is a structured work system.`

const MapView = dynamic(() => import('./MapView'), { ssr: false })

type ViewMode = 'map' | 'tree'

export interface ExternalConnection {
  connectionId: string
  myTeamId: string
  externalTeamId: string | null
  externalTeamName: string
  externalEmail: string
}

const SAT_MAT_GUIDE = `How Single Agent Team (SAT) works
Imagine you ask the Manager for an executive outline of how to build something. Once the structure is clear, you do not want to explain the whole context again to every Worker. You just want to say take point 1 or take point 2 and let them continue from there. You can only work that way with SAT. In SAT, all panels in the team use the same AI provider, and AISync allows the agents to receive a snapshot summary of the other panels in that same team. That gives the team more internal continuity and reduces repetition. SAT is the better choice when the work is linear, compact, and needs fast execution with shared continuity between panels.

How Multiple Agent Team (MAT) works
Now imagine the work benefits from different model styles. You may want one provider to explore options, another one to execute a defined path more strictly, and another one to work with larger or more multimodal context. In that case, MAT becomes more useful. In MAT, the team mixes different AI providers across its panels, and that snapshot is not injected in the same way. The work becomes more compartmentalized. In practice, this means you should ask the origin agent to prepare a clearer instruction, and then use Review & Forward to send that work to the panel that should continue. The receiving panel will get the message and respond based on its own context, without the shared snapshot that SAT provides. This gives you stronger compartmentalization and clearer contrast between provider behaviors.

Optional note — Example of agent selection by provider

General reference — subject to change as models evolve

OpenAI API models: strong general-purpose option for reasoning, coding, and broad task coverage.
Claude API models: especially strong for long-running execution, larger codebases, code review, debugging, and disciplined work over long context.
Gemini API models: especially strong for long-context and multimodal work, including documents, images, audio, and broader context-heavy flows.
Groq API models: especially useful when low latency, fast iteration, and quick response cycles matter most.`

const CREATE_TEAMS_GUIDE = `How to create a new team
Use this when the new team should start as its own branch.

Go to Teams Map
Click + Add Team
Enter the team name
Choose the agents and providers
Confirm
The new team will appear as a new branch in the structure.

How to create a new team within an existing Team structure
Use this when the new team should grow under a Manager that already exists.
Example: you already have one Manager coordinating a line of work, and now that line needs its own new subteam.

Go to Teams Map
Click + Add Team
Enter the new team name
Choose the agents and providers
In "Sub-team of (optional)" → where says "—None (root)—" select the existing Manager that should be the parent of this new team
Confirm
If you do this correctly, the new team will appear under that Manager in both Tree and Map. If you do not connect it to the right Manager, AISync will place it as a separate branch instead of growing the existing one.

How to add more Workers inside an existing team
Use this when you do not need a new team, but simply more execution capacity inside the current one.

Open the Edit view of the existing team
Add a new Worker
Make sure that Worker is associated with the current Manager of that team
Confirm
The new Worker will appear inside the existing team, under the correct Manager.

Practical rule
Use a new team when the work is separate.
Use a new team under an existing Manager when the work is a new branch of the same line.

A practical note
Keep each team focused on one subject or area. If the work grows, it is usually better to grow the structure by creating new branches in the right place than to overload one team with too many unrelated tasks.`

interface TeamsClientProps {
  pageName:     string
  projectName?: string
  projectId:    string
  initialTeams: TeamWithWorkspaces[]
}

export default function TeamsClient({ pageName, projectName, projectId, initialTeams }: TeamsClientProps) {
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
  const [showMainGuide,        setShowMainGuide]        = useState(false)
  const [showSatMatGuide,      setShowSatMatGuide]      = useState(false)
  const [showCreateTeamsGuide, setShowCreateTeamsGuide] = useState(false)

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

  const teamCodes = useMemo(() => computeTeamCodes(teams), [teams])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => {
      const codeA = teamCodes[a.id] ?? ''
      const codeB = teamCodes[b.id] ?? ''
      return codeA.localeCompare(codeB)
    }),
    [teams, teamCodes],
  )

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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to use Teams Map"
        pageSubtitleOnClick={() => setShowMainGuide(true)}
        projectName={projectName}
      />

      {/* ── Ribbon operativo ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 grid items-center gap-x-4 gap-y-2 px-4 py-2
          sm:grid-cols-[auto_auto_auto_1fr_auto]"
        style={{
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          background: 'linear-gradient(180deg, rgba(250,252,254,0.98) 0%, rgba(240,245,249,0.98) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 12px rgba(15,23,42,0.05)',
        }}
      >
        {/* Col 1 — Identidad del módulo */}
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-900 leading-none">
            Teams Map
          </h2>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Operational Elasticity View
          </div>
        </div>

        {/* Col 2 — Links de ayuda */}
        <div className="hidden sm:flex flex-col gap-0.5">
          <button
            className="text-left text-[11px] leading-4 text-teal-600 hover:underline underline-offset-2"
            onClick={() => setShowMainGuide(true)}
          >
            How to use Teams Map
          </button>
          <button
            className="text-left text-[11px] leading-4 text-teal-600 hover:underline underline-offset-2"
            onClick={() => setShowCreateTeamsGuide(true)}
          >
            How to create Teams
          </button>
        </div>

        {/* Col 3 — Leyenda SAT/MAT */}
        <div
          className="hidden sm:block shrink-0 rounded-[10px] border px-2.5 py-1.5 text-[10px] leading-[1.5] text-neutral-600"
          style={{
            borderColor: 'rgba(15,23,42,0.10)',
            background: 'rgba(255,255,255,0.88)',
          }}
        >
          <div>SAT = Single Agent Team</div>
          <div>MAT = Multiple Agent Team</div>
          <button
            className="mt-0.5 text-[9px] text-teal-600 hover:underline underline-offset-2"
            onClick={() => setShowSatMatGuide(true)}
          >
            Differences and uses
          </button>
        </div>

        {/* Col 4 — spacer */}
        <div className="hidden sm:block" />

        {/* Col 5 — Controles */}
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
        </div>
      </div>

      {/* Main view */}
      <div className="flex-1 min-h-0 relative">
        {view === 'map' ? (
          <MapView
            teams={sortedTeams}
            projectId={projectId}
            activeProjectId={projectId}
            connectedTeamIds={connectedTeamIds}
            externalConnections={externalConnections}
            teamCodes={teamCodes}
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
          <TreeView
            teams={sortedTeams}
            connectedTeamIds={connectedTeamIds}
            externalConnections={externalConnections}
            teamCodes={teamCodes}
            onEdit={t => setEditingTeam(t)}
            onDelete={t => setEditingTeam(t)}
            onConnect={() => setShowConnect(true)}
            zoomInSignal={zoomIn}
            zoomOutSignal={zoomOut}
            resetSignal={zoomReset}
          />
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

      {/* Main guide modal */}
      {showMainGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowMainGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to use Teams Map
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setShowMainGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {TEAMS_GUIDE}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SAT/MAT guide modal */}
      {showSatMatGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSatMatGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Single Agent Team (SAT) and Multiple Agent Team (MAT)
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">How they work and how to use them</p>
              </div>
              <button
                onClick={() => setShowSatMatGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{SAT_MAT_GUIDE}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Teams guide modal */}
      {showCreateTeamsGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowCreateTeamsGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to create or grow Teams
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setShowCreateTeamsGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{CREATE_TEAMS_GUIDE}</p>
            </div>
          </div>
        </div>
      )}

      <BottomRibbon />
    </div>
  )
}
