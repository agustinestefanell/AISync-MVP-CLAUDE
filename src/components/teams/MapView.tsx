'use client'

import { useMemo }     from 'react'
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
import type { ProjectNodeType }     from '@/lib/teams/getProjectColor'

interface MapViewProps {
  teams:               TeamWithWorkspaces[]
  projectId:           string
  activeProjectId:     string
  connectedTeamIds:    Set<string>
  externalConnections: ExternalConnection[]
  teamCodes?:          Record<string, string>
  onEdit:              (teamId: string) => void
  onConnect:           () => void
  zoomInSignal?:       number
  zoomOutSignal?:      number
  resetSignal?:        number
}

const CONNECT_TEAM_GAP    = 84
const CONNECT_TEAM_WIDTH  = 300
const CONNECT_TEAM_HEIGHT = 179

function ConnectTeamBox({ onConnect }: { onConnect: () => void }) {
  return (
    <button
      type="button"
      data-pan-block="true"
      className="flex h-full w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-6 text-center transition-colors hover:border-neutral-500 hover:bg-white/90"
      style={{
        borderColor: 'rgba(100,116,139,0.45)',
        background:  'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(241,245,249,0.92) 100%)',
        boxShadow:   'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 24px rgba(15,23,42,0.05)',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onConnect() }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-neutral-400 bg-white/85 text-[28px] font-semibold leading-none text-neutral-700">
        +
      </div>
      <div className="mt-4 text-[14px] font-semibold text-neutral-900">Connect Team</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">Link External User</div>
    </button>
  )
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
  teamCodes,
  onEdit,
  onConnect,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: MapViewProps) {
  const agentNodes = useMemo(() => deriveAgentNodesFromTeams(teams), [teams])
  const mapNodes   = useMemo(
    () => agentNodesToMapNodes(agentNodes, connectedTeamIds),
    [agentNodes, connectedTeamIds],
  )

  const roots = useMemo(() => mapNodes.filter(n => n.parentId === null), [mapNodes])

  const nodeTypeMap = useMemo((): Map<string, ProjectNodeType> => {
    const map   = new Map<string, ProjectNodeType>()
    const gmIds = new Set(mapNodes.filter(n => n.type === 'general_manager').map(n => n.id))
    for (const n of mapNodes) {
      if (n.type === 'general_manager')  map.set(n.id, 'gm')
      else if (n.type === 'worker')      map.set(n.id, 'worker')
      else map.set(n.id, gmIds.has(n.parentId ?? '') ? 'team' : 'subteam')
    }
    return map
  }, [mapNodes])

  // Build layout for all root trees, accumulate into flat lists with X offset
  const { allPlacements, allConnectors, totalWidth, totalHeight, connectTeamLeft } = useMemo(() => {
    if (!roots.length) {
      return { allPlacements: [], allConnectors: [], totalWidth: 0, totalHeight: 0, connectTeamLeft: 0 }
    }

    type PlacementExt = TreeLayoutPlacement & { projectId: string; rootIndex: number }
    type ConnectorExt = TreeLayoutConnector & { projectId: string }

    const placements: PlacementExt[] = []
    const connectors: ConnectorExt[] = []
    let   xOffset   = 0
    let   maxHeight = 0

    for (let rootIdx = 0; rootIdx < roots.length; rootIdx++) {
      const root    = roots[rootIdx]
      const subtree = getSubtreeNodes(root.id, mapNodes)
      const layout  = buildTreeLayout(root, subtree)

      for (const p of layout.placements) {
        placements.push({ ...p, x: p.x + xOffset, centerX: p.centerX + xOffset, projectId: root.projectId, rootIndex: rootIdx })
      }
      for (const c of layout.connectors) {
        connectors.push({ ...c, fromX: c.fromX + xOffset, toX: c.toX + xOffset, projectId: root.projectId })
      }

      xOffset   += layout.width + GAP_BETWEEN_ROOT_TREES
      maxHeight  = Math.max(maxHeight, layout.height)
    }

    const baseWidth = xOffset - GAP_BETWEEN_ROOT_TREES + 2 * MAP_CANVAS_PADDING_X
    return {
      allPlacements:   placements,
      allConnectors:   connectors,
      totalWidth:      baseWidth + CONNECT_TEAM_GAP + CONNECT_TEAM_WIDTH,
      totalHeight:     maxHeight + 2 * MAP_CANVAS_PADDING_Y,
      connectTeamLeft: baseWidth - MAP_CANVAS_PADDING_X + CONNECT_TEAM_GAP,
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
                  strokeWidth={2.5}
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
                teamCode={teamCodes?.[p.node.teamId]}
                projectIndex={p.rootIndex}
                nodeType={nodeTypeMap.get(p.node.id)}
                onOpen={wsId => window.open(`/workspace/${wsId}`, '_blank', 'noopener,noreferrer')}
                onEdit={onEdit}
              />
            </div>
          ))}

          {/* Single Connect Team box at the end of the GM row */}
          <div
            className="absolute"
            style={{
              left:   `${connectTeamLeft}px`,
              top:    `${MAP_CANVAS_PADDING_Y}px`,
              width:  `${CONNECT_TEAM_WIDTH}px`,
              height: `${CONNECT_TEAM_HEIGHT}px`,
            }}
          >
            <ConnectTeamBox onConnect={onConnect} />
          </div>
        </div>
      </CanvasViewport>
    </div>
  )
}
