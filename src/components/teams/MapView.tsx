'use client'

/**
 * MapView — Teams Map v3 con organigrama jerárquico
 *
 * Port desde preview validada, adaptado a datos reales de producción.
 * Arquitectura: acordeón por Project + canvas CanvasViewport + tree layout.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
import { filterArchivedTeams } from '@/lib/teams/filterArchivedTeams'
import { buildTreeLayout } from '@/lib/teams/buildTreeLayout'
import { getTeamTheme, getProviderDisplayName } from '@/lib/teams/teamsMapLayoutHelpers'
import { CanvasViewport } from './v3/CanvasViewport'
import { TreeLayoutCanvas } from './v3/TreeLayoutCanvas'
import { TreeWorkspaceCard } from './v3/TreeWorkspaceCard'
import type { TeamsGraphNode, TreeLayoutPlacement } from '@/lib/teams/teamsMapLayoutTypes'
import { MAP_CANVAS_PADDING_X, MAP_CANVAS_PADDING_Y, MAP_ROOT_WIDTH } from '@/lib/teams/teamsMapLayoutTypes'

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  projectName?: string
  projectOptions: Array<{ id: string; name: string }>
  showArchivedTeams: boolean
  zoomInSignal: number
  zoomOutSignal: number
  resetSignal: number
  onEdit: (team: TeamWithWorkspaces) => void
  onOpen: (workspaceId: string) => void
  onConnect: (projectId: string) => void
  onAddTeam: (projectId: string) => void
  onProjectRenamed: (projectId: string, newName: string) => void
}

interface Connection {
  id: string
  requester_account_id: string
  requester_email: string
  requester_team_id: string
  receiver_email: string
  receiver_account_id: string | null
  host_isolated_team_id?: string | null
  invitee_isolated_team_id?: string | null
  direction: 'outgoing' | 'incoming'
  status: string
  description?: string | null
  color?: string | null
}

// Build graph nodes from real TeamWithWorkspaces data
function buildGraphNodesForProject(
  teams: TeamWithWorkspaces[],
  projectId: string,
  projectName: string,
  projectIndex: number,
  teamCodes: Record<string, string>,
  connectionMetadata: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }>,
  connectionStatus: Record<string, string>
): { nodes: TeamsGraphNode[]; rootNode: TeamsGraphNode } {
  const nodes: TeamsGraphNode[] = []

  // Synthetic Executive Team node for this project
  const rootNode: TeamsGraphNode = {
    id: `gm_${projectId}`,
    type: 'general_manager',
    label: `Executive Team - ${projectName}`,
    provider: 'Anthropic',
    parentId: null,
    teamId: `exec_${projectId}`,
    teamType: 'SAT',
  }
  nodes.push(rootNode)

  // Root teams (parent_id === null)
  const rootTeams = teams.filter(t => !t.parent_id)

  rootTeams.forEach(team => {
    const managerSession = team.workspaces?.[0]?.agent_sessions?.find(s => s.agent_role === 'manager')
    const provider = (managerSession?.provider ?? 'Anthropic') as 'OpenAI' | 'Anthropic' | 'Google'

    // Check if this is a connected/shared team
    const isConnected = team.type === 'isolated'
    const connMeta = connectionMetadata[team.id]

    const teamNode: TeamsGraphNode = {
      id: team.id,
      type: 'senior_manager',
      label: team.name,
      provider,
      parentId: rootNode.id,
      teamId: team.id,
      teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
      isConnected,
      connectionRole: connMeta?.role,
      partnerEmail: connMeta?.partnerEmail,
      partnerOrg: undefined, // Not available in current data model
      connectionStatus: connectionStatus[team.id],
    }
    nodes.push(teamNode)

    // Add subteams recursively
    addSubteamsRecursive(team.id, teams, nodes, teamCodes, connectionMetadata, connectionStatus)

    // Add workers for this team (MAX 2) — isolated/Shared teams never have
    // real workers (agent_sessions worker1/worker2 there are DB scaffolding
    // created on connection accept, not user-added agents; EditTeamModal
    // doesn't even expose them for editing) — skip so an empty Shared Team
    // shows only its Manager box.
    const workers = isConnected
      ? []
      : team.workspaces?.[0]?.agent_sessions?.filter(s => s.agent_role !== 'manager') ?? []
    workers.slice(0, 2).forEach(worker => {
      const workerNode: TeamsGraphNode = {
        id: `${worker.id}_worker`,
        type: 'worker',
        label: worker.agent_role === 'worker1' ? 'Worker 1' : 'Worker 2',
        provider,
        parentId: team.id,
        teamId: team.id,
        teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
      }
      nodes.push(workerNode)
    })
  })

  return { nodes, rootNode }
}

function addSubteamsRecursive(
  parentId: string,
  allTeams: TeamWithWorkspaces[],
  nodes: TeamsGraphNode[],
  teamCodes: Record<string, string>,
  connectionMetadata: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }>,
  connectionStatus: Record<string, string>
) {
  const subteams = allTeams.filter(t => t.parent_id === parentId)

  subteams.forEach(subteam => {
    const managerSession = subteam.workspaces?.[0]?.agent_sessions?.find(s => s.agent_role === 'manager')
    const provider = (managerSession?.provider ?? 'Anthropic') as 'OpenAI' | 'Anthropic' | 'Google'

    const isConnected = subteam.type === 'isolated'
    const connMeta = connectionMetadata[subteam.id]

    const subteamNode: TeamsGraphNode = {
      id: subteam.id,
      type: 'senior_manager',
      label: subteam.name,
      provider,
      parentId,
      teamId: subteam.id,
      teamType: subteam.type === 'MAT' ? 'MAT' : 'SAT',
      isConnected,
      connectionRole: connMeta?.role,
      partnerEmail: connMeta?.partnerEmail,
      partnerOrg: undefined,
      connectionStatus: connectionStatus[subteam.id],
    }
    nodes.push(subteamNode)

    // Recursive subteams
    addSubteamsRecursive(subteam.id, allTeams, nodes, teamCodes, connectionMetadata, connectionStatus)

    // Workers for subteam (MAX 2) — same reasoning as root teams above:
    // isolated/Shared subteams never have real workers.
    const workers = isConnected
      ? []
      : subteam.workspaces?.[0]?.agent_sessions?.filter(s => s.agent_role !== 'manager') ?? []
    workers.slice(0, 2).forEach(worker => {
      const workerNode: TeamsGraphNode = {
        id: `${worker.id}_worker`,
        type: 'worker',
        label: worker.agent_role === 'worker1' ? 'Worker 1' : 'Worker 2',
        provider,
        parentId: subteam.id,
        teamId: subteam.id,
        teamType: subteam.type === 'MAT' ? 'MAT' : 'SAT',
      }
      nodes.push(workerNode)
    })
  })
}

export default function MapView({
  teams,
  projectName,
  projectOptions,
  showArchivedTeams,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
  onEdit,
  onOpen,
  onConnect,
  onAddTeam,
  onProjectRenamed,
}: MapViewProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [isProjectIndexOpen, setIsProjectIndexOpen] = useState(true)
  const projectSectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Ajuste 1 — rename inline del Project en el sidebar (doble click)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName,      setEditingName]      = useState('')
  const [renameError,      setRenameError]      = useState<string | null>(null)

  function startEditingProject(project: { id: string; name: string }) {
    setEditingProjectId(project.id)
    setEditingName(project.name)
    setRenameError(null)
  }

  async function commitProjectRename(projectId: string, currentName: string) {
    const trimmed = editingName.trim()
    setEditingProjectId(null)
    if (!trimmed || trimmed === currentName) return
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        setRenameError('Could not rename project.')
        return
      }
      onProjectRenamed(projectId, trimmed)
    } catch {
      setRenameError('Could not rename project.')
    }
  }

  // Fetch connections for partner email metadata
  useEffect(() => {
    fetch('/api/connections')
      .then(r => r.json())
      .then((data: Connection[]) => setConnections(Array.isArray(data) ? data : []))
      .catch(() => setConnections([]))
  }, [])

  // Filter archived teams respecting parent-child hierarchy
  const visibleTeams = useMemo(
    () => filterArchivedTeams(teams, showArchivedTeams),
    [teams, showArchivedTeams]
  )

  const teamCodes = useMemo(() => computeTeamCodes(visibleTeams), [visibleTeams])

  // Build connection metadata: map isolated team ID → { partnerEmail, role }
  const connectionMetadata = useMemo(() => {
    const map: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }> = {}

    connections.filter(c => c.status === 'active').forEach(conn => {
      const isHost = conn.direction === 'outgoing'
      const myTeamId = isHost ? conn.host_isolated_team_id : conn.invitee_isolated_team_id
      const partnerEmail = isHost ? conn.receiver_email : conn.requester_email
      const role: 'host' | 'invitee' = isHost ? 'host' : 'invitee'

      if (myTeamId) {
        map[myTeamId] = { partnerEmail, role }
      }
    })

    return map
  }, [connections])

  // Build connection status map: isolated team ID → connection status
  const connectionStatus = useMemo(() => {
    const map: Record<string, string> = {}

    connections.forEach(conn => {
      const isHost = conn.direction === 'outgoing'
      const myTeamId = isHost ? conn.host_isolated_team_id : conn.invitee_isolated_team_id

      if (myTeamId) {
        map[myTeamId] = conn.status
      }
    })

    return map
  }, [connections])

  // Group teams by project (using visible teams)
  const projectGroups = useMemo(() => {
    const grouped = new Map<string, TeamWithWorkspaces[]>()

    visibleTeams.forEach(team => {
      const pid = team.project_id
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid)!.push(team)
    })

    return Array.from(grouped.entries()).map(([pid, projectTeams], index) => {
      const pName = projectOptions.find(p => p.id === pid)?.name ?? projectName ?? 'Untitled Project'
      return {
        id: pid,
        name: pName,
        index,
        teams: projectTeams,
        count: projectTeams.length,
      }
    })
  }, [visibleTeams, projectName, projectOptions])

  // Build all project layouts (for stacked rendering)
  const allProjectLayouts = useMemo(() => {
    return projectGroups.map(project => {
      const { nodes: graphNodes, rootNode } = buildGraphNodesForProject(
        project.teams,
        project.id,
        project.name,
        project.index,
        teamCodes,
        connectionMetadata,
        connectionStatus
      )
      const layout = rootNode ? buildTreeLayout(rootNode, graphNodes, 'map') : null
      return { project, layout, rootNode, graphNodes }
    })
  }, [projectGroups, teamCodes, connectionMetadata, connectionStatus])

  // Scroll to project section handler
  const handleProjectClick = (projectId: string) => {
    const section = projectSectionRefs.current[projectId]
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (projectGroups.length === 0 || projectGroups.every(g => g.teams.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-sm text-slate-500">No teams in this project yet.</p>
        <p className="text-xs mt-1 text-slate-400">
          Add teams with workspaces and agents to see the map.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto bg-[#F5F7FA] relative">
      {/* Project Index Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-white border-r border-[#DDE6F1] shadow-lg transition-transform duration-300 z-30 ${
          isProjectIndexOpen ? 'translate-x-0' : '-translate-x-[240px]'
        }`}
        style={{ width: '240px' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDE6F1]">
            <span className="text-sm font-semibold text-[#0C1733] uppercase tracking-wide">
              Projects
            </span>
            <button
              onClick={() => setIsProjectIndexOpen(false)}
              className="text-[#5C6B82] hover:text-[#0C1733] transition-colors"
              aria-label="Close projects sidebar"
            >
              ✕
            </button>
          </div>

          {renameError && (
            <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-b border-[#E2E8F0]">
              {renameError}
            </div>
          )}

          {/* Projects list */}
          <div className="flex-1 overflow-y-auto">
            {projectGroups.map((project) => (
              <div
                key={project.id}
                onClick={() => { if (editingProjectId !== project.id) handleProjectClick(project.id) }}
                className="w-full text-left px-4 py-3 border-b border-[#E2E8F0] hover:bg-[#F8FBFF] transition-colors cursor-pointer"
              >
                {editingProjectId === project.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => commitProjectRename(project.id, project.name)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingProjectId(null)
                    }}
                    className="text-sm font-medium text-[#0C1733] mb-1 w-full bg-white border border-indigo-400 rounded px-1 outline-none"
                  />
                ) : (
                  <div
                    onDoubleClick={e => { e.stopPropagation(); startEditingProject(project) }}
                    className="text-sm font-medium text-[#0C1733] mb-1"
                    title="Double-click to rename"
                  >
                    {project.name}
                  </div>
                )}
                <div className="text-xs text-[#5C6B82]">
                  {project.count} Team{project.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsed tab */}
      {!isProjectIndexOpen && (
        <button
          onClick={() => setIsProjectIndexOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-white border border-[#DDE6F1] rounded-r-lg shadow-lg px-2 py-6 z-30 hover:bg-[#F8FBFF] transition-colors"
          style={{ writingMode: 'vertical-rl' }}
          aria-label="Open projects sidebar"
        >
          <span className="text-xs font-semibold text-[#0C1733] uppercase tracking-wider">
            Projects
          </span>
        </button>
      )}

      <div className={`mx-auto w-full p-6 transition-all duration-300 ${isProjectIndexOpen ? 'pl-[260px]' : ''}`}>
        <div className="flex flex-col gap-12">
          {allProjectLayouts.map(({ project, layout, rootNode, graphNodes }) => {
            if (!layout || !rootNode) {
              return (
                <div
                  key={project.id}
                  className="rounded-lg border border-[#D7E2EE] bg-white p-8 text-center"
                >
                  <p className="text-[#64748B]">No data to display for {project.name}</p>
                </div>
              )
            }

            return (
              <div
                key={project.id}
                ref={(el) => {
                  projectSectionRefs.current[project.id] = el
                }}
                className="flex flex-col gap-4"
              >
                {/* Project header (stable, outside zoom/pan transform) */}
                <div className="w-full flex items-center justify-between px-6 py-3 bg-white rounded-lg border border-[#DDE6F1] shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-base font-semibold text-[#0C1733]">
                      {project.name}
                    </span>
                    <button
                      onClick={() => onAddTeam(project.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#DDE6F1] bg-white px-3 py-1.5 text-xs font-medium text-[#0C1733] hover:bg-[#F8FBFF] transition-colors"
                    >
                      + Add Team
                    </button>
                    <button
                      onClick={() => onConnect(project.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#BFE7C8] bg-white px-3 py-1.5 text-xs font-medium text-[#63C37D] hover:bg-[#E9F8EE] transition-colors"
                    >
                      + Connect with other user
                    </button>
                  </div>
                  <span className="text-sm text-[#5C6B82]">
                    {project.count} Team{project.count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Project tree canvas (zoomable/pannable) */}
                <CanvasViewport
                  initialZoom={1}
                  minZoom={0.05}
                  maxZoom={1.12}
                  fitFloor={0.5}
                  fitTopOffset={0}
                  alignTopOnFit
                  zoomInSignal={zoomInSignal}
                  zoomOutSignal={zoomOutSignal}
                  resetSignal={resetSignal}
                  contentWidthClass="inline-flex w-max flex-col items-center"
                >
                  <TreeLayoutCanvas
                    layout={layout}
                    paddingX={MAP_CANVAS_PADDING_X}
                    paddingY={MAP_CANVAS_PADDING_Y}
                    connectorColor="rgba(100, 116, 139, 0.52)"
                    connectorStrokeWidth={3}
                  >
                    {(placement: TreeLayoutPlacement) => {
                      const node = placement.node
                      const colorKey = node.type === 'senior_manager' && node.parentId === rootNode.id
                        ? node.id
                        : node.teamId
                      const theme = getTeamTheme(colorKey)
                      const code = teamCodes[node.id] || ''

                      // Find real team for Open/Edit actions
                      const realTeam = project.teams.find(t => t.id === node.id)

                      // General Manager card (synthetic Executive Team)
                      if (node.type === 'general_manager') {
                        return (
                          <TreeWorkspaceCard
                            title={node.label}
                            subtitle="Executive Team"
                            functionLabel="Project Coordination"
                            brief="Strategic oversight and cross-team alignment for all teams in this project."
                            ribbonColor="#0B4B78"
                            softColor="rgba(11, 75, 120, 0.08)"
                            borderColor="rgba(11, 75, 120, 0.22)"
                            accentColor="#083854"
                            tags={['Leadership', 'Strategy', 'Oversight']}
                            metrics={[]}
                            isSat
                            explicitWidth={MAP_ROOT_WIDTH}
                            actionLabel="Overview"
                            onPrimaryAction={() => {
                              // Executive Team overview — placeholder
                              console.log('Executive Team Overview')
                            }}
                          />
                        )
                      }

                      // Worker card (compact)
                      if (node.type === 'worker') {
                        // Workers inherit archived status from their parent team
                        const workerRealTeam = project.teams.find(t => t.id === node.teamId)
                        const isWorkerArchived = workerRealTeam?.status === 'archived'

                        // Find the actual agent_session for this worker to get individual description
                        const workerSession = workerRealTeam?.workspaces?.[0]?.agent_sessions?.find(
                          s => s.agent_role === (node.label === 'Worker 1' ? 'worker1' : 'worker2')
                        )

                        return (
                          <TreeWorkspaceCard
                            title={node.label}
                            subtitle="Worker"
                            functionLabel="Execution lane"
                            brief={workerSession?.description ?? "Executes assigned tasks and returns compact updates."}
                            ribbonColor={theme.ribbon}
                            softColor={theme.soft}
                            borderColor={theme.border}
                            accentColor={theme.accent}
                            tags={['Execution', getProviderDisplayName(node.provider)]}
                            metrics={[]}
                            compact
                            isArchived={isWorkerArchived}
                            actionLabel=""
                            onPrimaryAction={() => {}}
                          />
                        )
                      }

                      // Senior Manager card (Team/Subteam)
                      const workersCount = graphNodes.filter(n => n.parentId === node.id && n.type === 'worker').length
                      const isArchived = realTeam?.status === 'archived'

                      return (
                        <TreeWorkspaceCard
                          title={`${code ? `${code} · ` : ''}${node.label}`}
                          subtitle={
                            node.isConnected
                              ? 'Connected Team'
                              : node.parentId === rootNode.id
                                ? 'Team Manager'
                                : 'Subteam Manager'
                          }
                          functionLabel="Team coordination"
                          brief={realTeam?.description ?? "Coordinates delivery lane, manages artifacts, and oversees handoffs."}
                          ribbonColor={theme.ribbon}
                          softColor={theme.soft}
                          borderColor={theme.border}
                          accentColor={theme.accent}
                          tags={[
                            node.teamType,
                            getProviderDisplayName(node.provider),
                            'Operations',
                          ]}
                          metrics={[
                            {
                              label: 'Workers',
                              value: String(workersCount),
                            },
                          ]}
                          isSat={node.teamType === 'SAT'}
                          isArchived={isArchived}
                          isConnected={node.isConnected}
                          connectionRole={node.connectionRole}
                          partnerEmail={node.partnerEmail}
                          partnerOrg={node.partnerOrg}
                          connectionStatus={node.connectionStatus}
                          actionLabel="Open"
                          secondaryActionLabel="Edit"
                          onPrimaryAction={() => {
                            if (realTeam?.workspaces?.[0]?.id) {
                              onOpen(realTeam.workspaces[0].id)
                            }
                          }}
                          onSecondaryAction={() => {
                            if (realTeam) {
                              onEdit(realTeam)
                            }
                          }}
                        />
                      )
                    }}
                  </TreeLayoutCanvas>
                </CanvasViewport>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
