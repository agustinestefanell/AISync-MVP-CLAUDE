'use client'

/**
 * MapView — Teams Map v3 con organigrama jerárquico
 *
 * Port desde preview validada, adaptado a datos reales de producción.
 * Arquitectura: acordeón por Project + canvas CanvasViewport + tree layout.
 */

import { useState, useMemo, useEffect } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
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

// Filter archived teams respecting hierarchy
// If a parent is archived and hidden, its children are also hidden to avoid orphan nodes
function filterArchivedTeams(
  teams: TeamWithWorkspaces[],
  showArchived: boolean
): TeamWithWorkspaces[] {
  if (showArchived) return teams

  // Keep only active teams
  const activeTeams = teams.filter(t => t.status !== 'archived')
  const activeIds = new Set(activeTeams.map(t => t.id))

  // Filter out teams whose parent is not in the visible set
  return activeTeams.filter(team => {
    if (!team.parent_id) return true // Root teams are always included if active
    return activeIds.has(team.parent_id) // Only include if parent is visible
  })
}

// Build graph nodes from real TeamWithWorkspaces data
function buildGraphNodesForProject(
  teams: TeamWithWorkspaces[],
  projectId: string,
  projectName: string,
  projectIndex: number,
  teamCodes: Record<string, string>,
  connectionMetadata: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }>
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
    }
    nodes.push(teamNode)

    // Add subteams recursively
    addSubteamsRecursive(team.id, teams, nodes, teamCodes, connectionMetadata)

    // Add workers for this team (MAX 2)
    const workers = team.workspaces?.[0]?.agent_sessions?.filter(s => s.agent_role !== 'manager') ?? []
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
  connectionMetadata: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }>
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
    }
    nodes.push(subteamNode)

    // Recursive subteams
    addSubteamsRecursive(subteam.id, allTeams, nodes, teamCodes, connectionMetadata)

    // Workers for subteam (MAX 2)
    const workers = subteam.workspaces?.[0]?.agent_sessions?.filter(s => s.agent_role !== 'manager') ?? []
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

// Project Canvas component
function ProjectCanvas({
  project,
  teams,
  teamCodes,
  connectionMetadata,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
  onEdit,
  onOpen,
}: {
  project: { id: string; name: string; index: number }
  teams: TeamWithWorkspaces[]
  teamCodes: Record<string, string>
  connectionMetadata: Record<string, { partnerEmail: string; role: 'host' | 'invitee' }>
  zoomInSignal: number
  zoomOutSignal: number
  resetSignal: number
  onEdit: (team: TeamWithWorkspaces) => void
  onOpen: (workspaceId: string) => void
}) {
  const { nodes: graphNodes, rootNode } = useMemo(
    () => buildGraphNodesForProject(teams, project.id, project.name, project.index, teamCodes, connectionMetadata),
    [teams, project.id, project.name, project.index, teamCodes, connectionMetadata]
  )

  const layout = useMemo(() => {
    if (!rootNode) return null
    return buildTreeLayout(rootNode, graphNodes, 'map')
  }, [rootNode, graphNodes])

  if (!layout || !rootNode) {
    return (
      <div className="rounded-lg border border-[#D7E2EE] bg-white p-8 text-center">
        <p className="text-[#64748B]">No data to display for {project.name}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
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
          connectorStrokeWidth={2}
        >
          {(placement: TreeLayoutPlacement) => {
            const node = placement.node
            const colorKey = node.type === 'senior_manager' && node.parentId === rootNode.id
              ? node.id
              : node.teamId
            const theme = getTeamTheme(colorKey)
            const code = teamCodes[node.id] || ''

            // Find real team for Open/Edit actions
            const realTeam = teams.find(t => t.id === node.id)

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
              // BUG FIX: realTeam was undefined for Workers because it searched by node.id (synthetic)
              // instead of node.teamId (real team ID)
              const workerRealTeam = teams.find(t => t.id === node.teamId)
              const isWorkerArchived = workerRealTeam?.status === 'archived'

              return (
                <TreeWorkspaceCard
                  title={node.label}
                  subtitle="Worker"
                  functionLabel="Execution lane"
                  brief="Executes assigned tasks and returns compact updates."
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
                brief="Coordinates delivery lane, manages artifacts, and oversees handoffs."
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
}: MapViewProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])

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
    <div className="w-full h-full overflow-auto p-6 bg-[#F5F7FA]">
      <div className="mx-auto w-full">
        <div className="overflow-hidden rounded-[18px] border border-[#DDE6F1] bg-white shadow-[0_8px_24px_rgba(12,23,51,0.05)]">
          {projectGroups.map((project, idx) => {
            const isExpanded = expandedProject === project.id

            return (
              <div
                key={project.id}
                className={idx > 0 ? 'border-t border-[#DDE6F1]' : ''}
              >
                {/* Accordion row header */}
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="flex h-14 w-full items-center justify-between px-5 transition-colors hover:bg-[#F8FBFF]"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`h-4 w-4 text-[#5C6B82] transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-base font-semibold text-[#0C1733]">
                      {project.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#5C6B82]">
                      {project.count} Team{project.count !== 1 ? 's' : ''}
                    </span>
                    {isExpanded && (
                      <span className="rounded-full bg-[#E9F8EE] px-3 py-1 text-xs font-medium text-[#2F8A47]">
                        Open
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded content — canvas */}
                {isExpanded && (
                  <div className="bg-[#F8FBFF] px-5 py-6 min-h-[70vh]">
                    <ProjectCanvas
                      project={project}
                      teams={project.teams}
                      teamCodes={teamCodes}
                      connectionMetadata={connectionMetadata}
                      zoomInSignal={zoomInSignal}
                      zoomOutSignal={zoomOutSignal}
                      resetSignal={resetSignal}
                      onEdit={onEdit}
                      onOpen={onOpen}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
