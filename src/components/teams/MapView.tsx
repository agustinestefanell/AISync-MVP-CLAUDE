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
  onConnect:          () => void
  zoomInSignal?:      number
  zoomOutSignal?:     number
  resetSignal?:       number
}

function ConnectTeamAnchor({ onConnect }: { onConnect: () => void }) {
  return (
    <div
      data-pan-block="true"
      className="absolute"
      style={{ left: 'calc(100% + 84px)', top: '28px', width: '300px' }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          left: '-84px', top: '96px', width: '84px',
          borderTop: '2px dashed rgba(100,116,139,0.52)',
        }}
      />
      <button
        type="button"
        data-pan-block="true"
        className="flex min-h-[188px] w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-6 text-center transition-colors hover:border-neutral-500 hover:bg-white/90"
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
    </div>
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
  onEdit,
  onConnect,
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

  // [DIAG] PASO 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (typeof window !== 'undefined') console.log('[MAP ROOTS]', roots.map(r => r.teamName || r.id))

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

      // [DIAG] PASO 2
      console.log('[MAP WIDTHS]', { name: root.teamName, subtreeWidth: layout.width, GAP: GAP_BETWEEN_ROOT_TREES, xOffsetBefore: xOffset })

      for (const p of layout.placements) {
        placements.push({ ...p, x: p.x + xOffset, centerX: p.centerX + xOffset, projectId: root.projectId })
      }
      for (const c of layout.connectors) {
        connectors.push({ ...c, fromX: c.fromX + xOffset, toX: c.toX + xOffset, projectId: root.projectId })
      }

      xOffset   += layout.width + GAP_BETWEEN_ROOT_TREES
      maxHeight  = Math.max(maxHeight, layout.height)
    }

    // [DIAG] PASO 3
    console.log('[MAP POSITIONS]', placements.slice(0, 8).map(p => ({
      name: p.node.teamName,
      type: p.node.type,
      x: p.x,
      centerX: p.centerX,
      subtreeWidth: p.subtreeWidth,
    })))

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
              {p.node.type === 'general_manager' && p.projectId === activeProjectId && (
                <ConnectTeamAnchor onConnect={onConnect} />
              )}
            </div>
          ))}
        </div>
      </CanvasViewport>
    </div>
  )
}
