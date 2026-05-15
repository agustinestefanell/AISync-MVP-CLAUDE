import * as dagre from '@dagrejs/dagre'
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
  gm_node:     { width: 300, height: 165 },
  sm_node:     { width: 260, height: 160 },
  worker_node: { width: 220, height: 130 },
}

export function buildAgentGraph(
  agentNodes: AgentNode[],
  connectedTeamIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  if (!agentNodes.length) return { nodes: [], edges: [] }

  // Assign palette per team in order of first appearance
  const teamOrder: string[] = []
  for (const a of agentNodes) {
    if (!teamOrder.includes(a.teamId)) teamOrder.push(a.teamId)
  }
  const paletteMap: Record<string, { ribbon: string; soft: string }> = {}
  teamOrder.forEach((tid, i) => {
    paletteMap[tid] = TEAM_PALETTE[i % TEAM_PALETTE.length]
  })

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

  // Dagre layout
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80 })

  for (const a of graphAgents) {
    g.setNode(a.agentId, NODE_SIZE[a.nodeType])
  }

  const edges: Edge[] = []
  for (const a of graphAgents) {
    if (a.parentAgentId) {
      g.setEdge(a.parentAgentId, a.agentId)
      edges.push({
        id:     `e-${a.parentAgentId}-${a.agentId}`,
        source: a.parentAgentId,
        target: a.agentId,
        type:   'smoothstep',
        style:  { stroke: '#94a3b8', strokeWidth: 1.5 },
      })
    }
  }

  dagre.layout(g)

  const nodes: Node[] = graphAgents.map(a => {
    const { x, y } = g.node(a.agentId)
    const size      = NODE_SIZE[a.nodeType]
    const palette   = paletteMap[a.teamId] ?? TEAM_PALETTE[0]

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
      position:  { x: x - size.width / 2, y: y - size.height / 2 },
      data,
      draggable: false,
    }
  })

  return { nodes, edges }
}
