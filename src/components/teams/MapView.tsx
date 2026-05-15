'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import CanvasViewport from './CanvasViewport'
import AgentCard from './map/AgentCard'
import { deriveAgentNodesFromTeams } from '@/lib/db/agent-map'
import { agentNodesToMapNodes, buildAgentLayout } from '@/lib/map/buildAgentLayout'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { ExternalConnection } from './TeamsClient'

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  projectId: string
  connectedTeamIds: Set<string>
  externalConnections: ExternalConnection[]
  onEdit: (teamId: string) => void
  zoomInSignal?: number
  zoomOutSignal?: number
  resetSignal?: number
}

export default function MapView({
  teams,
  connectedTeamIds,
  onEdit,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: MapViewProps) {
  const router = useRouter()

  const agentNodes = useMemo(() => deriveAgentNodesFromTeams(teams), [teams])

  const mapNodes = useMemo(
    () => agentNodesToMapNodes(agentNodes, connectedTeamIds),
    [agentNodes, connectedTeamIds],
  )

  const layout = useMemo(() => buildAgentLayout(mapNodes), [mapNodes])

  if (agentNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm" style={{ color: '#64748b' }}>No agents in this project yet.</p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Add teams with workspaces and agents to see the map.
        </p>
      </div>
    )
  }

  const { placements, connectors, totalWidth, totalHeight } = layout

  return (
    <div className="w-full h-full">
      <CanvasViewport
        initialZoom={1}
        minZoom={0.05}
        maxZoom={1.12}
        fitFloor={0.5}
        alignTopOnFit
        zoomInSignal={zoomInSignal}
        zoomOutSignal={zoomOutSignal}
        resetSignal={resetSignal}
      >
        <div
          className="relative"
          style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
        >
          {/* L-shaped connectors */}
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={totalWidth}
            height={totalHeight}
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
            aria-hidden="true"
          >
            {connectors.map((c, i) => {
              const midY = c.fromY + (c.toY - c.fromY) / 2
              const d    = `M ${c.fromX} ${c.fromY} V ${midY} H ${c.toX} V ${c.toY}`
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="rgba(51,65,85,0.62)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                />
              )
            })}
          </svg>

          {/* Agent cards */}
          {placements.map((p) => (
            <div
              key={p.node.id}
              className="absolute"
              style={{
                left:   `${p.x}px`,
                top:    `${p.y}px`,
                width:  `${p.width}px`,
                height: `${p.height}px`,
              }}
            >
              <AgentCard
                node={p.node}
                onOpen={(wsId) => router.push(`/workspace/${wsId}`)}
                onEdit={onEdit}
              />
            </div>
          ))}
        </div>
      </CanvasViewport>
    </div>
  )
}
