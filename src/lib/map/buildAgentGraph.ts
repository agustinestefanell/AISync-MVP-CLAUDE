import type { Node, Edge } from '@xyflow/react'
import type { AgentNode } from '@/lib/db/agent-map'

export interface AgentNodeData extends Record<string, unknown> {
  agentId: string
  provider: string
  model: string
  workspaceId: string
  teamId: string
  teamName: string
  teamType: 'SAT' | 'MAT'
  teamDescription: string | null
  ribbon: string
  soft: string
  connected: boolean
}

const TEAM_PALETTE = [
  { ribbon: '#314155', soft: 'rgba(49,65,85,0.08)' },
  { ribbon: '#0f6b68', soft: 'rgba(15,107,104,0.08)' },
  { ribbon: '#7f2630', soft: 'rgba(127,38,48,0.08)' },
  { ribbon: '#2d5f98', soft: 'rgba(45,95,152,0.08)' },
  { ribbon: '#5a3e85', soft: 'rgba(90,62,133,0.08)' },
  { ribbon: '#8a4a16', soft: 'rgba(138,74,22,0.08)' },
  { ribbon: '#1a6b3c', soft: 'rgba(26,107,60,0.08)' },
  { ribbon: '#4a4a4a', soft: 'rgba(74,74,74,0.08)' },
]

const NODE_SIZE: Record<string, { width: number; height: number }> = {
  gm_node:     { width: 300, height: 160 },
  sm_node:     { width: 260, height: 150 },
  worker_node: { width: 220, height: 110 },
}

const H_GAP   = 30   // horizontal gap between sibling subtrees
const V_GAP   = 60   // vertical gap between parent and children row
const ROOT_GAP = 80  // horizontal gap between disconnected root trees

// --- Custom recursive tree layout (no dagre) ---

function subtreeWidth(
  id: string,
  children: Record<string, string[]>,
  types: Record<string, string>,
  cache: Record<string, number>,
): number {
  if (cache[id] !== undefined) return cache[id]
  const kids = children[id] ?? []
  const nodeW = NODE_SIZE[types[id]]?.width ?? 220
  if (!kids.length) { cache[id] = nodeW; return nodeW }
  const kidsTotal = kids.reduce((s, k) => s + subtreeWidth(k, children, types, cache), 0)
                  + H_GAP * (kids.length - 1)
  cache[id] = Math.max(nodeW, kidsTotal)
  return cache[id]
}

function assignPositions(
  id: string,
  centerX: number,
  y: number,
  children: Record<string, string[]>,
  types: Record<string, string>,
  cache: Record<string, number>,
  out: Record<string, { x: number; y: number }>,
) {
  const nodeW = NODE_SIZE[types[id]]?.width  ?? 220
  const nodeH = NODE_SIZE[types[id]]?.height ?? 110
  out[id] = { x: centerX - nodeW / 2, y }

  const kids = children[id] ?? []
  if (!kids.length) return

  const kidsTotal = kids.reduce((s, k) => s + subtreeWidth(k, children, types, cache), 0)
                  + H_GAP * (kids.length - 1)
  let cx = centerX - kidsTotal / 2
  for (const kid of kids) {
    const kw = subtreeWidth(kid, children, types, cache)
    assignPositions(kid, cx + kw / 2, y + nodeH + V_GAP, children, types, cache, out)
    cx += kw + H_GAP
  }
}

// ------------------------------------------------

export function buildAgentGraph(
  agentNodes: AgentNode[],
  connectedTeamIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  if (!agentNodes.length) return { nodes: [], edges: [] }

  // Palette per team (order of first appearance)
  const teamOrder: string[] = []
  for (const a of agentNodes) {
    if (!teamOrder.includes(a.teamId)) teamOrder.push(a.teamId)
  }
  const paletteMap: Record<string, { ribbon: string; soft: string }> = {}
  teamOrder.forEach((tid, i) => { paletteMap[tid] = TEAM_PALETTE[i % TEAM_PALETTE.length] })

  // managerMap: teamId → agentId of that team's manager
  const managerMap: Record<string, string> = {}
  for (const a of agentNodes) {
    if (a.role === 'manager') managerMap[a.teamId] = a.agentId
  }

  type GraphAgent = AgentNode & {
    nodeType: 'gm_node' | 'sm_node' | 'worker_node'
    parentAgentId: string | null
  }

  const graphAgents: GraphAgent[] = agentNodes.map(a => {
    let nodeType: 'gm_node' | 'sm_node' | 'worker_node'
    let parentAgentId: string | null = null

    if (a.role === 'manager' && a.teamParentId === null) {
      nodeType = 'gm_node'
    } else if (a.role === 'manager') {
      nodeType = 'sm_node'
      parentAgentId = managerMap[a.teamParentId!] ?? null
    } else {
      nodeType = 'worker_node'
      parentAgentId = managerMap[a.teamId] ?? null
    }

    return { ...a, nodeType, parentAgentId }
  })

  // Build children map and type map
  const childrenMap: Record<string, string[]> = {}
  const typeMap: Record<string, string> = {}
  const roots: string[] = []

  for (const a of graphAgents) {
    typeMap[a.agentId] = a.nodeType
    if (!childrenMap[a.agentId]) childrenMap[a.agentId] = []
    if (a.parentAgentId) {
      if (!childrenMap[a.parentAgentId]) childrenMap[a.parentAgentId] = []
      childrenMap[a.parentAgentId].push(a.agentId)
    } else {
      roots.push(a.agentId)
    }
  }

  // Compute subtree widths
  const swCache: Record<string, number> = {}
  roots.forEach(r => subtreeWidth(r, childrenMap, typeMap, swCache))

  // Assign positions — place root trees side by side
  const positions: Record<string, { x: number; y: number }> = {}
  const totalRootsW = roots.reduce((s, r) => s + (swCache[r] ?? 0), 0)
                    + ROOT_GAP * (roots.length - 1)
  let rx = -totalRootsW / 2
  for (const r of roots) {
    const rw = swCache[r] ?? 0
    assignPositions(r, rx + rw / 2, 0, childrenMap, typeMap, swCache, positions)
    rx += rw + ROOT_GAP
  }

  // Build ReactFlow edges
  const edges: Edge[] = graphAgents
    .filter(a => a.parentAgentId)
    .map(a => ({
      id:     `e-${a.parentAgentId}-${a.agentId}`,
      source: a.parentAgentId!,
      target: a.agentId,
      type:   'smoothstep',
      style:  { stroke: '#94a3b8', strokeWidth: 1.5 },
    }))

  // Build ReactFlow nodes
  const nodes: Node[] = graphAgents.map(a => {
    const pos     = positions[a.agentId] ?? { x: 0, y: 0 }
    const palette = paletteMap[a.teamId] ?? TEAM_PALETTE[0]

    const data: AgentNodeData = {
      agentId:         a.agentId,
      provider:        a.provider,
      model:           a.model,
      workspaceId:     a.workspaceId,
      teamId:          a.teamId,
      teamName:        a.teamName,
      teamType:        a.teamType,
      teamDescription: a.teamDescription,
      ribbon:          palette.ribbon,
      soft:            palette.soft,
      connected:       connectedTeamIds.has(a.teamId),
    }

    return {
      id:        a.agentId,
      type:      a.nodeType,
      position:  pos,
      data,
      draggable: false,
    }
  })

  return { nodes, edges }
}
