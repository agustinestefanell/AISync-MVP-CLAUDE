'use client'

/**
 * TeamsMapV3Preview — Fase 0-B con acordeón de Projects
 *
 * Preview aislada con algoritmo buildTreeLayout real + patrón de acordeón
 * Port literal del patrón expandedProject de ProjectList.tsx
 * NO toca MapView.tsx ni TeamsClient.tsx de producción
 */

import { useState, useMemo } from 'react'
import { CanvasViewport } from './CanvasViewport'
import { buildTreeLayout } from './buildTreeLayout'
import { TreeLayoutCanvas } from './TreeLayoutCanvas'
import { TreeWorkspaceCard } from './TreeWorkspaceCard'
import {
  SCENARIOS,
  type MockProject,
  type MockTeam,
  type MockSubteam,
} from './mockTeamsMapV3Data'
import type {
  TeamsGraphNode,
  TreeLayoutPlacement,
} from './teamsMapLayoutTypes'
import {
  MAP_CANVAS_PADDING_X,
  MAP_CANVAS_PADDING_Y,
  MAP_ROOT_WIDTH,
} from './teamsMapLayoutTypes'
import { getTeamTheme, getProviderDisplayName } from './teamsMapLayoutHelpers'

type ScenarioKey = 'minimum' | 'normal'

// Port of computeTeamCodes logic — adapted for MockProject structure
// (original in src/lib/teams/computeTeamCodes.ts)
function projectLetter(i: number): string {
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (i < 26) return base[i]
  return base[Math.floor(i / 26) - 1] + base[i % 26]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function assignChildrenCodes(
  parentId: string,
  prefix: string,
  allTeams: TeamWithParent[],
  codes: Record<string, string>,
): void {
  const children = allTeams.filter((t) => t.parentId === parentId)
  children.forEach((child, i) => {
    const code = `${prefix}-${pad2(i + 1)}`
    codes[child.id] = code
    assignChildrenCodes(child.id, code, allTeams, codes)
  })
}

type TeamWithParent = (MockTeam | MockSubteam) & { parentId?: string }

function computeTeamCodesForProject(
  project: MockProject,
  projectIndex: number,
): Record<string, string> {
  const codes: Record<string, string> = {}
  const letter = projectLetter(projectIndex)

  // Root teams (teams directly under project, no parent_id)
  const allTeamsFlat: TeamWithParent[] = []

  project.teams.forEach((team) => {
    allTeamsFlat.push(team as TeamWithParent)
    team.subteams.forEach((subteam) => {
      allTeamsFlat.push({ ...subteam, parentId: team.id })
    })
  })

  if (project.connectedTeams) {
    project.connectedTeams.forEach((team) => {
      allTeamsFlat.push(team as TeamWithParent)
    })
  }

  // Assign root codes
  const roots = project.teams.concat(project.connectedTeams || [])
  roots.forEach((root, rootIdx) => {
    const code = rootIdx === 0 ? `${letter}-00` : `${letter}-${pad2(rootIdx)}`
    codes[root.id] = code
    assignChildrenCodes(root.id, code, allTeamsFlat, codes)
  })

  return codes
}

// Convert MockProject structure to TeamsGraphNode flat list
function buildGraphNodes(project: MockProject, projectIndex: number): {
  nodes: TeamsGraphNode[]
  codes: Record<string, string>
} {
  const nodes: TeamsGraphNode[] = []
  const codes = computeTeamCodesForProject(project, projectIndex)

  // Add synthetic root General Manager node per project
  const rootNode: TeamsGraphNode = {
    id: `gm_${project.id}`,
    type: 'general_manager',
    label: `Executive Team - ${project.name}`,
    provider: 'Anthropic',
    parentId: null,
    teamId: `exec_${project.id}`,
    teamType: 'SAT',
  }
  nodes.push(rootNode)

  // Add teams (own teams)
  project.teams.forEach((team) => {
    const teamNode: TeamsGraphNode = {
      id: team.id,
      type: 'senior_manager',
      label: team.name,
      provider: team.provider as 'OpenAI' | 'Anthropic' | 'Google',
      parentId: rootNode.id,
      teamId: team.id,
      teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
    }
    nodes.push(teamNode)

    // Add subteams
    team.subteams.forEach((subteam) => {
      const subteamNode: TeamsGraphNode = {
        id: subteam.id,
        type: 'senior_manager',
        label: subteam.name,
        provider: subteam.provider as 'OpenAI' | 'Anthropic' | 'Google',
        parentId: team.id,
        teamId: team.id,
        teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
      }
      nodes.push(subteamNode)

      // Add workers for subteam (MAX 2 enforced)
      subteam.workers.slice(0, 2).forEach((worker) => {
        const workerNode: TeamsGraphNode = {
          id: worker.id,
          type: 'worker',
          label: worker.name,
          provider: subteam.provider as 'OpenAI' | 'Anthropic' | 'Google',
          parentId: subteam.id,
          teamId: team.id,
          teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
        }
        nodes.push(workerNode)
      })
    })

    // Add workers for main team (MAX 2 enforced)
    team.workers.slice(0, 2).forEach((worker) => {
      const workerNode: TeamsGraphNode = {
        id: worker.id,
        type: 'worker',
        label: worker.name,
        provider: team.provider as 'OpenAI' | 'Anthropic' | 'Google',
        parentId: team.id,
        teamId: team.id,
        teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
      }
      nodes.push(workerNode)
    })
  })

  // Add connected teams (integrated into tree, not separate container)
  if (project.connectedTeams) {
    project.connectedTeams.forEach((team) => {
      const connectedNode: TeamsGraphNode = {
        id: team.id,
        type: 'senior_manager',
        label: team.name,
        provider: team.provider as 'OpenAI' | 'Anthropic' | 'Google',
        parentId: rootNode.id,
        teamId: team.id,
        teamType: team.type === 'MAT' ? 'MAT' : 'SAT',
        isConnected: true, // Mark for visual differentiation
        connectionRole: team.connectionRole,
        partnerEmail: team.partnerEmail,
        partnerOrg: team.partnerOrg,
      }
      nodes.push(connectedNode)
    })
  }

  return { nodes, codes }
}

// ProjectCanvas component — receives zoom signals and renders single project tree
function ProjectCanvas({
  project,
  projectIndex,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: {
  project: MockProject
  projectIndex: number
  zoomInSignal: number
  zoomOutSignal: number
  resetSignal: number
}) {
  const { nodes: graphNodes, codes } = useMemo(
    () => buildGraphNodes(project, projectIndex),
    [project, projectIndex],
  )
  const rootNode = graphNodes.find((n) => n.type === 'general_manager')

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
            // For color: use node.id for top-level teams (each gets unique color)
            // For subteams/workers: use teamId (inherit from parent team)
            const colorKey = node.type === 'senior_manager' && node.parentId === rootNode.id
              ? node.id  // Top-level teams: unique color per team
              : node.teamId  // Subteams/Workers: inherit parent color
            const theme = getTeamTheme(colorKey)
            const code = codes[node.id] || ''

            // General Manager card (root synthetic node)
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
                  onPrimaryAction={() => console.log('Open Executive Overview')}
                />
              )
            }

            // Worker card (compact)
            if (node.type === 'worker') {
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
                  actionLabel="Open"
                  onPrimaryAction={() => console.log(`Open worker ${node.id}`)}
                />
              )
            }

            // Senior Manager card (Team/Subteam)
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
                    value: String(
                      graphNodes.filter(
                        (n) => n.parentId === node.id && n.type === 'worker',
                      ).length,
                    ),
                  },
                ]}
                isSat={node.teamType === 'SAT'}
                isConnected={node.isConnected}
                connectionRole={node.connectionRole}
                partnerEmail={node.partnerEmail}
                partnerOrg={node.partnerOrg}
                actionLabel="Open"
                secondaryActionLabel="Edit"
                onPrimaryAction={() => console.log(`Open team ${node.id}`)}
                onSecondaryAction={() => console.log(`Edit team ${node.id}`)}
              />
            )
          }}
        </TreeLayoutCanvas>
      </CanvasViewport>
    </div>
  )
}

export default function TeamsMapV3Preview() {
  const [scenario, setScenario] = useState<ScenarioKey>('normal')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [zoomInSignal, setZoomInSignal] = useState(0)
  const [zoomOutSignal, setZoomOutSignal] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)

  const projects = SCENARIOS[scenario]

  // Compute total teams and workers count across all projects
  const totalTeams = useMemo(() => {
    return projects.reduce((sum, p) => sum + p.teams.length + (p.connectedTeams?.length || 0), 0)
  }, [projects])

  const totalWorkers = useMemo(() => {
    let count = 0
    projects.forEach(p => {
      p.teams.forEach(t => {
        count += t.workers.length
        t.subteams.forEach(st => {
          count += st.workers.length
        })
      })
    })
    return count
  }, [projects])

  return (
    <div className="flex h-screen flex-col bg-[#F5F7FA]">
      {/* Header ribbon — portado de TeamsClient.tsx con adaptaciones */}
      <div className="flex items-start justify-between gap-4 bg-[#F7FAFC] px-6 py-4 shadow-sm">
        {/* Zona izquierda — título + links + badges */}
        <div className="flex flex-wrap items-start gap-4">
          {/* Título + subtítulo */}
          <div className="shrink-0">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-900 leading-none">
              Teams Map
            </h2>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Operational Elasticity View
            </div>
          </div>

          {/* Selector Minimum / Normal (reemplaza selector de Project) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Scenario:
            </span>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioKey)}
              className="text-[12px] font-medium text-neutral-800 bg-white border border-neutral-200 rounded-md px-2 py-1 outline-none hover:border-neutral-300 transition-colors cursor-pointer"
            >
              <option value="minimum">Minimum</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          {/* Burbuja SAT/MAT */}
          <div
            className="hidden sm:block shrink-0 rounded-[10px] border px-2.5 py-1.5 text-[10px] leading-[1.5] text-neutral-600"
            style={{
              borderColor: 'rgba(15,23,42,0.10)',
              background: 'rgba(255,255,255,0.88)',
            }}
          >
            <div>SAT = Single Agent Team</div>
            <div>MAT = Multiple Agent Team</div>
          </div>

          {/* Links agrupados */}
          <div className="hidden sm:flex flex-col gap-0.5">
            <button
              className="text-left text-[11px] leading-4 text-teal-600 underline underline-offset-2 hover:opacity-75"
              onClick={() => console.log('How to use Teams Map')}
            >
              How to use Teams Map (click here)
            </button>
            <button
              className="text-left text-[11px] leading-4 text-teal-600 underline underline-offset-2 hover:opacity-75"
              onClick={() => console.log('How to create Teams')}
            >
              How to create Teams (click here)
            </button>
          </div>
        </div>

        {/* Zona derecha — controles */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Teams / Workers count */}
            <div
              className="rounded-[10px] border px-3 py-2 text-xs text-neutral-700"
              style={{
                borderColor: 'rgba(15,23,42,0.10)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,247,250,0.95) 100%)',
              }}
            >
              Teams {totalTeams} / Workers {totalWorkers}
            </div>

            {/* Zoom controls */}
            <button
              onClick={() => setZoomOutSignal((prev) => prev + 1)}
              className="rounded bg-white px-3 py-1 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30"
              disabled={!expandedProject}
            >
              −
            </button>
            <button
              onClick={() => setResetSignal((prev) => prev + 1)}
              className="rounded bg-white px-3 py-1 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30"
              disabled={!expandedProject}
            >
              Reset
            </button>
            <button
              onClick={() => setZoomInSignal((prev) => prev + 1)}
              className="rounded bg-white px-3 py-1 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30"
              disabled={!expandedProject}
            >
              +
            </button>

            {/* Add Team */}
            <button
              onClick={() => console.log('Add Team')}
              className="flex h-9 items-center gap-1.5 rounded-[10px] bg-neutral-900 px-4 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
            >
              + Add Team
            </button>
          </div>
        </div>
      </div>

      {/* Accordion container — ajustado para canvas extendido sin recorte */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto w-full">
          <div className="overflow-hidden rounded-[18px] border border-[#DDE6F1] bg-white shadow-[0_8px_24px_rgba(12,23,51,0.05)]">
            {projects.map((project, idx) => {
              const isExpanded = expandedProject === project.id
              const teamsCount = project.teams.length + (project.connectedTeams?.length || 0)

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
                        {teamsCount} Team{teamsCount !== 1 ? 's' : ''}
                      </span>
                      {isExpanded && (
                        <span className="rounded-full bg-[#E9F8EE] px-3 py-1 text-xs font-medium text-[#2F8A47]">
                          Open
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded content — canvas extendido sin límite de ancho */}
                  {isExpanded && (
                    <div className="bg-[#F8FBFF] px-5 py-6 min-h-[70vh]">
                      <ProjectCanvas
                        project={project}
                        projectIndex={idx}
                        zoomInSignal={zoomInSignal}
                        zoomOutSignal={zoomOutSignal}
                        resetSignal={resetSignal}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
