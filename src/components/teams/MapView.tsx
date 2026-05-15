'use client'

import { useMemo }     from 'react'
import { useRouter }   from 'next/navigation'
import CanvasViewport  from './map/CanvasViewport'
import TeamAgentCard   from './map/TeamAgentCard'
import { deriveAgentNodesFromTeams }        from '@/lib/db/agent-map'
import { agentNodesToMapNodes }             from '@/lib/map/buildAgentLayout'
import {
  buildTreeLayout,
  MAP_CANVAS_PADDING_X,
  MAP_CANVAS_PADDING_Y,
  GAP_BETWEEN_ROOT_TREES,
  type TreeLayoutPlacement,
  type TreeLayoutConnector,
} from '@/lib/map/buildTreeLayout'
import type { TeamWithWorkspaces }  from '@/lib/db/types'
import type { ExternalConnection }  from './TeamsClient'
import type { MapAgentNode }        from '@/lib/map/buildAgentLayout'

interface MapViewProps {
  teams:              TeamWithWorkspaces[]
  projectId:          string
  activeProjectId:    string
  connectedTeamIds:   Set<string>
  externalConnections: ExternalConnection[]
  onEdit:             (teamId: string) => void
  zoomInSignal?:      number
  zoomOutSignal?:     number
  resetSignal?:       number
}

function getSubtreeNodes(rootId: string, all: MapAgentNode[]): MapAgentNode[] {
  const ids   = new Set<string>()
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    ids.add(id)
    for (const n of all) if (n.parentId === id) queue.push(n.id)
  }
  return all.filter(n => ids.has(n.id))
}

export default function MapView({
  teams,
  activeProjectId,
  connectedTeamIds,
  onEdit,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: MapViewProps) {
  const router = useRouter()

  const agentNodes = useMemo(() => deriveAgentNodesFromTeams(teams), [teams])
  const mapNodes   = useMemo(
    () => agentNodesToMapNodes(agentNodes, connectedTeamIds),
    [agentNodes, connectedTeamIds],
  )

  const roots = useMemo(() => mapNodes.filter(n => n.parentId === null), [mapNodes])

  // Build layout for all root trees, accumulate into flat lists with X offset
  const { allPlacements, allConnectors, totalWidth, totalHeight } = useMemo(() => {
    if (!roots.length) {
      return { allPlacements: [], allConnectors: [], totalWidth: 0, totalHeight: 0 }
    }

    type PlacementExt = TreeLayoutPlacement & { projectId: string }
    type ConnectorExt = TreeLayoutConnector & { projectId: string }

    const placements: PlacementExt[] = []
    const connectors: ConnectorExt[] = []
    let   xOffset   = 0
    let   maxHeight = 0

    for (const root of roots) {
      const subtree = getSubtreeNodes(root.id, mapNodes)
      const layout  = buildTreeLayout(root, subtree)

      for (const p of layout.placements) {
        placements.push({ ...p, x: p.x + xOffset, centerX: p.centerX + xOffset, projectId: root.projectId })
      }
      for (const c of layout.connectors) {
        connectors.push({ ...c, fromX: c.fromX + xOffset, toX: c.toX + xOffset, projectId: root.projectId })
      }

      xOffset   += layout.width + GAP_BETWEEN_ROOT_TREES
      maxHeight  = Math.max(maxHeight, layout.height)
    }

    return {
      allPlacements: placements,
      allConnectors: connectors,
      totalWidth:    xOffset - GAP_BETWEEN_ROOT_TREES + 2 * MAP_CANVAS_PADDING_X,
      totalHeight:   maxHeight + 2 * MAP_CANVAS_PADDING_Y,
    }
  }, [roots, mapNodes])

  if (!roots.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm" style={{ color: '#64748b' }}>No agents in this project yet.</p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Add teams with workspaces and agents to see the map.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <CanvasViewport
        initialZoom={1}
        minZoom={0.05}
        maxZoom={1.12}
        fitFloor={0.5}
        alignTopOnFit
        contentWidthClass="inline-flex w-max flex-col items-center"
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
            {allConnectors.map((c, i) => {
              const fx   = c.fromX + MAP_CANVAS_PADDING_X
              const fy   = c.fromY + MAP_CANVAS_PADDING_Y
              const tx   = c.toX   + MAP_CANVAS_PADDING_X
              const ty   = c.toY   + MAP_CANVAS_PADDING_Y
              const midY = fy + (ty - fy) / 2
              const d    = `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="rgba(51,65,85,0.62)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  opacity={c.projectId === activeProjectId ? 1 : 0.4}
                />
              )
            })}
          </svg>

          {/* Agent cards */}
          {allPlacements.map(p => (
            <div
              key={p.node.id}
              className="absolute"
              style={{
                left:    `${p.x    + MAP_CANVAS_PADDING_X}px`,
                top:     `${p.topY + MAP_CANVAS_PADDING_Y}px`,
                width:   `${p.width}px`,
                height:  `${p.height}px`,
                opacity: p.projectId === activeProjectId ? 1 : 0.4,
              }}
            >
              <TeamAgentCard
                node={p.node}
                onOpen={wsId => router.push(`/workspace/${wsId}`)}
                onEdit={onEdit}
              />
            </div>
          ))}
        </div>
      </CanvasViewport>
    </div>
  )
}
