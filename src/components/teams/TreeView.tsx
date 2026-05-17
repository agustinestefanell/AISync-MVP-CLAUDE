'use client'

import { useMemo }    from 'react'
import CanvasViewport from './map/CanvasViewport'
import { deriveAgentNodesFromTeams }    from '@/lib/db/agent-map'
import { agentNodesToMapNodes }         from '@/lib/map/buildAgentLayout'
import {
  buildTreeLayout,
  TREE_CANVAS_PADDING_X,
  TREE_CANVAS_PADDING_Y,
  type TreeLayoutPlacement,
  type TreeLayoutConnector,
} from '@/lib/map/buildTreeLayout'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { ExternalConnection }  from './TeamsClient'
import type { MapAgentNode }        from '@/lib/map/buildAgentLayout'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFamilyColor(color: string, alpha: number): string {
  const normalized = color.replace('#', '').trim()
  if (![3, 6].includes(normalized.length)) return color
  const expanded = normalized.length === 3
    ? normalized.split('').map(c => `${c}${c}`).join('')
    : normalized
  const r = parseInt(expanded.slice(0, 2), 16)
  const g = parseInt(expanded.slice(2, 4), 16)
  const b = parseInt(expanded.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
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

// ─── Compact node card (port of demo TreeOverviewView inline renderer) ────────

const TREE_CONNECT_GAP    = 56
const TREE_CONNECT_WIDTH  = 116
const TREE_CONNECT_HEIGHT = 84

function TreeConnectTeamBox({ onConnect }: { onConnect: () => void }) {
  return (
    <button
      type="button"
      data-pan-block="true"
      className="flex h-full w-full flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-2 py-2 text-center transition-colors hover:border-neutral-500 hover:bg-white/90"
      style={{
        borderColor: 'rgba(100,116,139,0.45)',
        background:  'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241,245,249,0.96) 100%)',
        boxShadow:   'inset 0 1px 0 rgba(255,255,255,0.75), 0 6px 14px rgba(15,23,42,0.05)',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onConnect() }}
    >
      <div className="text-[18px] font-semibold leading-none text-neutral-700">+</div>
      <div className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-[1.15] text-neutral-900">Connect Team</div>
      <div className="mt-1 text-[7px] uppercase tracking-[0.16em] text-neutral-500">Link External</div>
    </button>
  )
}

function TreeNode({
  p,
  onOpen,
  onEdit,
}: {
  p:      TreeLayoutPlacement
  onOpen: (wsId: string) => void
  onEdit: (teamId: string) => void
}) {
  const { node } = p

  if (node.type === 'general_manager') {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[16px] border px-2 py-2 text-center text-white"
        style={{
          borderColor: 'rgba(15,23,42,0.18)',
          background:  'linear-gradient(180deg, #0f172a 0%, #172235 100%)',
          boxShadow:   '0 10px 22px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div className="text-[8px] uppercase tracking-[0.18em] text-white/55">Main</div>
        <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-[1.2]">{node.teamName}</div>
      </div>
    )
  }

  const ribbon    = node.ribbon
  const soft      = node.soft
  const accent    = getFamilyColor(ribbon, 0.85)
  const isSM      = node.type === 'senior_manager'
  const roleLabel = isSM ? 'Team' : 'Worker'
  const boxBorder = isSM ? getFamilyColor(ribbon, 0.35) : getFamilyColor(accent, 0.28)
  const boxBg     = isSM
    ? `linear-gradient(180deg, ${getFamilyColor(ribbon, 0.2)} 0%, ${getFamilyColor(ribbon, 0.2)} 34%, rgba(255,255,255,0.96) 34%, rgba(255,255,255,0.96) 100%)`
    : `linear-gradient(180deg, ${getFamilyColor(ribbon, 0.18)} 0%, ${getFamilyColor(ribbon, 0.18)} 32%, rgba(255,255,255,0.97) 32%, rgba(255,255,255,0.97) 100%)`

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center ${isSM ? 'rounded-[18px]' : 'rounded-[16px]'}`}
      style={{
        border:     `1px solid ${boxBorder}`,
        background: boxBg,
        boxShadow:  isSM
          ? `0 10px 22px rgba(15,23,42,0.08), inset 0 3px 0 ${accent}, inset 0 1px 0 rgba(255,255,255,0.75)`
          : `0 8px 18px rgba(15,23,42,0.07), inset 0 3px 0 ${accent}, inset 0 1px 0 rgba(255,255,255,0.75)`,
      }}
    >
      {node.teamType === 'SAT' && (
        <div
          className="absolute right-1.5 top-1.5 rounded-[7px] border px-1.5 py-0.5 text-[8px] font-semibold leading-none text-neutral-700"
          style={{ borderColor: 'rgba(15,23,42,0.16)', background: 'rgba(255,255,255,0.96)', boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }}
        >
          SAT
        </div>
      )}
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 py-2">
        <div
          className="rounded-full px-2 py-1 text-[8px] uppercase tracking-[0.14em]"
          style={{ color: accent, background: getFamilyColor(soft, 0.92), border: `1px solid ${getFamilyColor(accent, 0.2)}` }}
        >
          {roleLabel}
        </div>
        <div className="line-clamp-3 text-[11px] font-semibold leading-[1.2] text-neutral-900">
          {node.teamName}
        </div>
        <div className="flex items-center gap-1 pt-0.5">
          <button
            type="button"
            data-pan-block="true"
            className="rounded-full border px-2 py-[3px] text-[9px] font-medium leading-none text-neutral-700 transition-colors hover:text-neutral-900"
            style={{ borderColor: getFamilyColor(accent, 0.24), background: 'rgba(255,255,255,0.82)' }}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen(node.workspaceId) }}
          >
            Open
          </button>
          <button
            type="button"
            data-pan-block="true"
            className="rounded-full border px-2 py-[3px] text-[9px] font-medium leading-none text-neutral-600 transition-colors hover:text-neutral-800"
            style={{ borderColor: getFamilyColor(accent, 0.18), background: getFamilyColor(soft, 0.44) }}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(node.teamId) }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Public: TreeView ─────────────────────────────────────────────────────────

interface TreeViewProps {
  teams:               TeamWithWorkspaces[]
  connectedTeamIds:    Set<string>
  externalConnections: ExternalConnection[]
  onEdit:              (team: TeamWithWorkspaces) => void
  onDelete:            (team: TeamWithWorkspaces) => void
  onConnect:           () => void
  zoomInSignal?:       number
  zoomOutSignal?:      number
  resetSignal?:        number
}

export default function TreeView({
  teams,
  connectedTeamIds,
  onEdit,
  onConnect,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: TreeViewProps) {
  const agentNodes = useMemo(() => deriveAgentNodesFromTeams(teams), [teams])
  const mapNodes   = useMemo(
    () => agentNodesToMapNodes(agentNodes, connectedTeamIds),
    [agentNodes, connectedTeamIds],
  )
  const roots = useMemo(() => mapNodes.filter(n => n.parentId === null), [mapNodes])

  const { allPlacements, allConnectors, totalWidth, totalHeight, connectTeamLeft } = useMemo(() => {
    if (!roots.length) {
      return { allPlacements: [], allConnectors: [], totalWidth: 0, totalHeight: 0, connectTeamLeft: 0 }
    }

    type PlacementExt = TreeLayoutPlacement & { projectId: string }
    type ConnectorExt = TreeLayoutConnector & { projectId: string }

    const placements: PlacementExt[] = []
    const connectors: ConnectorExt[] = []
    let   xOffset   = 0
    let   maxHeight = 0

    for (const root of roots) {
      const subtree = getSubtreeNodes(root.id, mapNodes)
      const layout  = buildTreeLayout(root, subtree, 'tree')

      for (const p of layout.placements) {
        placements.push({ ...p, x: p.x + xOffset, centerX: p.centerX + xOffset, projectId: root.projectId })
      }
      for (const c of layout.connectors) {
        connectors.push({ ...c, fromX: c.fromX + xOffset, toX: c.toX + xOffset, projectId: root.projectId })
      }

      xOffset   += layout.width + 20
      maxHeight  = Math.max(maxHeight, layout.height)
    }

    const baseWidth = xOffset - 20 + 2 * TREE_CANVAS_PADDING_X
    return {
      allPlacements:   placements,
      allConnectors:   connectors,
      totalWidth:      baseWidth + TREE_CONNECT_GAP + TREE_CONNECT_WIDTH,
      totalHeight:     maxHeight + 2 * TREE_CANVAS_PADDING_Y,
      connectTeamLeft: baseWidth - TREE_CANVAS_PADDING_X + TREE_CONNECT_GAP,
    }
  }, [roots, mapNodes])

  const handleEdit = (teamId: string) => {
    const team = teams.find(t => t.id === teamId)
    if (team) onEdit(team)
  }

  if (!roots.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm" style={{ color: '#64748b' }}>No agents in this project yet.</p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Add teams with workspaces and agents to see the tree.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <CanvasViewport
        initialZoom={1}
        minZoom={0.05}
        maxZoom={1.18}
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
              const fx   = c.fromX + TREE_CANVAS_PADDING_X
              const fy   = c.fromY + TREE_CANVAS_PADDING_Y
              const tx   = c.toX   + TREE_CANVAS_PADDING_X
              const ty   = c.toY   + TREE_CANVAS_PADDING_Y
              const midY = fy + (ty - fy) / 2
              const d    = `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="rgba(71,85,105,0.56)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.45}
                />
              )
            })}
          </svg>

          {/* Compact nodes */}
          {allPlacements.map(p => (
            <div
              key={p.node.id}
              className="absolute"
              style={{
                left:   `${p.x    + TREE_CANVAS_PADDING_X}px`,
                top:    `${p.topY + TREE_CANVAS_PADDING_Y}px`,
                width:  `${p.width}px`,
                height: `${p.height}px`,
              }}
            >
              <TreeNode
                p={p}
                onOpen={wsId => window.open(`/workspace/${wsId}`, '_blank', 'noopener,noreferrer')}
                onEdit={handleEdit}
              />
            </div>
          ))}

          {/* Single Connect Team box at the end of the GM row */}
          <div
            className="absolute"
            style={{
              left:   `${connectTeamLeft}px`,
              top:    `${TREE_CANVAS_PADDING_Y}px`,
              width:  `${TREE_CONNECT_WIDTH}px`,
              height: `${TREE_CONNECT_HEIGHT}px`,
            }}
          >
            <TreeConnectTeamBox onConnect={onConnect} />
          </div>
        </div>
      </CanvasViewport>
    </div>
  )
}
