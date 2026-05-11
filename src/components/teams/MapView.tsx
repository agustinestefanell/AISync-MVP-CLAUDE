'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TeamNode from './TeamNode'
import ExternalTeamNode from './ExternalTeamNode'
import { TeamsContext } from './TeamsContext'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { ExternalConnection } from './TeamsClient'

const NODE_TYPES = { teamNode: TeamNode, externalTeamNode: ExternalTeamNode }

const NODE_W = 288
const NODE_H = 190
const H_GAP  = 56
const V_GAP  = 90

function buildLayout(teams: TeamWithWorkspaces[]): Record<string, { x: number; y: number }> {
  const idSet = new Set(teams.map(t => t.id))
  const childrenMap: Record<string, string[]> = {}
  const roots: string[] = []

  for (const t of teams) {
    if (!childrenMap[t.id]) childrenMap[t.id] = []
    const parentId = (t.parent_id && idSet.has(t.parent_id)) ? t.parent_id : null
    if (parentId) {
      if (!childrenMap[parentId]) childrenMap[parentId] = []
      childrenMap[parentId].push(t.id)
    } else {
      roots.push(t.id)
    }
  }

  const subtreeW: Record<string, number> = {}
  function computeW(id: string): number {
    const children = childrenMap[id] ?? []
    if (!children.length) return (subtreeW[id] = NODE_W)
    const total = children.reduce((s, c) => s + computeW(c), 0) + H_GAP * (children.length - 1)
    return (subtreeW[id] = Math.max(NODE_W, total))
  }
  roots.forEach(computeW)

  const pos: Record<string, { x: number; y: number }> = {}
  function assign(id: string, centerX: number, y: number) {
    pos[id] = { x: centerX - NODE_W / 2, y }
    const children = childrenMap[id] ?? []
    if (!children.length) return
    const childrenTotal = children.reduce((s, c) => s + subtreeW[c], 0) + H_GAP * (children.length - 1)
    let cx = centerX - childrenTotal / 2
    for (const cid of children) {
      assign(cid, cx + subtreeW[cid] / 2, y + NODE_H + V_GAP)
      cx += subtreeW[cid] + H_GAP
    }
  }

  const totalRootsW = roots.reduce((s, r) => s + (subtreeW[r] ?? NODE_W), 0) + H_GAP * (roots.length - 1)
  let rx = -totalRootsW / 2
  for (const r of roots) {
    assign(r, rx + (subtreeW[r] ?? NODE_W) / 2, 0)
    rx += (subtreeW[r] ?? NODE_W) + H_GAP
  }

  return pos
}

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  connectedTeamIds: Set<string>
  externalConnections: ExternalConnection[]
  onEdit: (team: TeamWithWorkspaces) => void
}

export default function MapView({ teams, connectedTeamIds, externalConnections, onEdit }: MapViewProps) {
  const router = useRouter()
  const layout = useMemo(() => buildLayout(teams), [teams])

  const maxLocalY = useMemo(() => {
    const ys = Object.values(layout).map(p => p.y)
    return ys.length > 0 ? Math.max(...ys) : 0
  }, [layout])

  // onEdit intentionally excluded from node data — passed via TeamsContext instead
  const localNodes: Node[] = useMemo(() =>
    teams.map(team => ({
      id:       team.id,
      type:     'teamNode',
      position: layout[team.id] ?? { x: 0, y: 0 },
      data:     { team, connected: connectedTeamIds.has(team.id) },
      draggable: false,
    })),
  [teams, layout, connectedTeamIds])

  const externalNodes: Node[] = useMemo(() => {
    if (!externalConnections.length) return []
    const extY   = maxLocalY + NODE_H + V_GAP * 2
    const totalW = externalConnections.length * (NODE_W + H_GAP) - H_GAP
    const startX = -totalW / 2
    return externalConnections.map((ec, i) => ({
      id:       `external-${ec.connectionId}`,
      type:     'externalTeamNode',
      position: { x: startX + i * (NODE_W + H_GAP), y: extY },
      data:     { externalTeamName: ec.externalTeamName, externalEmail: ec.externalEmail },
      draggable: false,
    }))
  }, [externalConnections, maxLocalY])

  const localEdges: Edge[] = useMemo(() =>
    teams
      .filter(t => t.parent_id && layout[t.parent_id])
      .map(t => ({
        id:     `e-${t.parent_id}-${t.id}`,
        source: t.parent_id!,
        target: t.id,
        type:   'smoothstep',
        style:  { stroke: '#374151', strokeWidth: 2 },
      })),
  [teams, layout])

  const externalEdges: Edge[] = useMemo(() =>
    externalConnections
      .filter(ec => ec.myTeamId && layout[ec.myTeamId])
      .map(ec => ({
        id:       `ext-${ec.connectionId}`,
        source:   ec.myTeamId,
        target:   `external-${ec.connectionId}`,
        type:     'smoothstep',
        animated: true,
        style:    { stroke: '#0d9488', strokeWidth: 2, strokeDasharray: '6 3' },
      })),
  [externalConnections, layout])

  const nodes = useMemo(() => [...localNodes, ...externalNodes], [localNodes, externalNodes])
  const edges = useMemo(() => [...localEdges, ...externalEdges], [localEdges, externalEdges])

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-gray-500 text-sm">No teams in this project.</p>
        <p className="text-gray-700 text-xs mt-1">Use &quot;+ Add Team&quot; to create the first one.</p>
      </div>
    )
  }

  return (
    <TeamsContext.Provider value={{
      onOpen: (wsId) => router.push(`/workspace/${wsId}`),
      onEdit,
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={proOptions}
      >
        <Background color="#1f2937" gap={24} />
        <Controls
          showInteractive={false}
          className="!bg-gray-900 !border-gray-700 !rounded-xl [&>button]:!bg-gray-900 [&>button]:!border-gray-700 [&>button]:!text-gray-400"
        />
        <MiniMap
          nodeColor={(n) => n.type === 'externalTeamNode' ? '#0f766e' : '#374151'}
          maskColor="rgba(0,0,0,0.65)"
          style={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
        />
      </ReactFlow>
    </TeamsContext.Provider>
  )
}
