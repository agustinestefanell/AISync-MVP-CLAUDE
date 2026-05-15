import type { AgentNode } from '@/lib/db/agent-map'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapAgentNode {
  id: string
  type: 'general_manager' | 'senior_manager' | 'worker'
  label: string
  provider: string
  model: string
  workspaceId: string
  teamId: string
  teamName: string
  teamType: 'SAT' | 'MAT'
  teamDescription: string | null
  parentId: string | null
  ribbon: string
  soft: string
  connected: boolean
}

export interface AgentPlacement {
  node: MapAgentNode
  x: number
  y: number
  width: number
  height: number
  centerX: number
  bottomY: number
}

export interface AgentConnector {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface AgentLayoutResult {
  placements: AgentPlacement[]
  connectors: AgentConnector[]
  totalWidth: number
  totalHeight: number
}

// ─── Constants (demo map-mode values) ────────────────────────────────────────

const GM_W  = 760,  GM_H  = 212
const SM_W  = 356,  SM_H  = 364
const WK_W  = 316,  WK_H  = 312
const LEVEL_GAP        = 140
const SIBLING_GAP      = 92
const INTER_TEAM_GAP         = Math.round(316 / 3)  // 105 — rule of thirds
const FAMILY_BREAK_GAP       = INTER_TEAM_GAP        // gap between different-type siblings
const GAP_BETWEEN_ROOT_TREES = Math.round(316 / 3)   // 105 — exactly 1/3 of worker card width
const PAD_X            = 128
const PAD_Y            = 40

// ─── Palette ─────────────────────────────────────────────────────────────────

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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function nodeSize(type: string): { width: number; height: number } {
  if (type === 'general_manager') return { width: GM_W, height: GM_H }
  if (type === 'worker')          return { width: WK_W, height: WK_H }
  return                                 { width: SM_W, height: SM_H }
}

const TYPE_ORDER = { general_manager: 0, senior_manager: 1, worker: 2 } as const
function sortedChildren(all: MapAgentNode[], parentId: string): MapAgentNode[] {
  return all
    .filter(n => n.parentId === parentId)
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3))
}

function siblingGap(l: MapAgentNode, r: MapAgentNode): number {
  return l.type !== r.type ? FAMILY_BREAK_GAP : SIBLING_GAP
}

function getSubtreeIds(rootId: string, all: MapAgentNode[]): Set<string> {
  const ids = new Set<string>()
  const q   = [rootId]
  while (q.length) {
    const id = q.shift()!
    ids.add(id)
    for (const n of all) if (n.parentId === id) q.push(n.id)
  }
  return ids
}

// ─── Single-tree layout  (direct port of demo's buildTreeLayout) ──────────────

function buildSingleTree(
  rootId: string,
  nodes: MapAgentNode[],
): { placements: AgentPlacement[]; connectors: AgentConnector[]; width: number; height: number } {

  const byId   = new Map(nodes.map(n => [n.id, n]))
  const depths = new Map<string, number>()
  const swById = new Map<string, number>()
  const levelH: number[] = []

  const kids = (id: string) => sortedChildren(nodes, id)

  const childrenSpan = (children: MapAgentNode[]): number =>
    children.length === 0 ? 0 :
    children.reduce((total, c, i) =>
      i === 0 ? (swById.get(c.id) ?? 0)
              : total + siblingGap(children[i - 1], c) + (swById.get(c.id) ?? 0),
    0)

  const symmetricRoot = (children: MapAgentNode[]) => {
    if (!children.length) return { totalWidth: GM_W, centersById: new Map<string, number>() }
    const centers = new Map<string, number>()
    const widths  = children.map(c => swById.get(c.id) ?? 0)
    const mid     = Math.floor(children.length / 2)

    if (children.length % 2 === 1) {
      centers.set(children[mid].id, 0)
      for (let i = mid + 1; i < children.length; i++) {
        const prev = centers.get(children[i - 1].id) ?? 0
        centers.set(children[i].id, prev + widths[i - 1] / 2 + siblingGap(children[i - 1], children[i]) + widths[i] / 2)
      }
      for (let i = mid - 1; i >= 0; i--) {
        const next = centers.get(children[i + 1].id) ?? 0
        centers.set(children[i].id, next - widths[i + 1] / 2 - siblingGap(children[i], children[i + 1]) - widths[i] / 2)
      }
    } else {
      const lm = mid - 1, rm = mid
      const mg = siblingGap(children[lm], children[rm])
      centers.set(children[lm].id, -(mg / 2 + widths[lm] / 2))
      centers.set(children[rm].id,   mg / 2 + widths[rm] / 2)
      for (let i = rm + 1; i < children.length; i++) {
        const prev = centers.get(children[i - 1].id) ?? 0
        centers.set(children[i].id, prev + widths[i - 1] / 2 + siblingGap(children[i - 1], children[i]) + widths[i] / 2)
      }
      for (let i = lm - 1; i >= 0; i--) {
        const next = centers.get(children[i + 1].id) ?? 0
        centers.set(children[i].id, next - widths[i + 1] / 2 - siblingGap(children[i], children[i + 1]) - widths[i] / 2)
      }
    }

    const half = children.reduce((max, c, i) =>
      Math.max(max, Math.abs(centers.get(c.id) ?? 0) + widths[i] / 2), 0)

    return { totalWidth: Math.max(GM_W, half * 2), centersById: centers }
  }

  // 1. Assign depths
  const assignDepth = (id: string, depth: number) => {
    const n = byId.get(id)
    if (!n) return
    depths.set(id, depth)
    const sz = nodeSize(n.type)
    levelH[depth] = Math.max(levelH[depth] ?? 0, sz.height)
    for (const c of kids(id)) assignDepth(c.id, depth + 1)
  }
  assignDepth(rootId, 0)

  const depthY = levelH.reduce<number[]>((acc, _h, i) => {
    acc[i] = i === 0 ? 0 : acc[i - 1] + levelH[i - 1] + LEVEL_GAP
    return acc
  }, [])

  // 2. Measure subtrees bottom-up
  const measure = (id: string): number => {
    const n = byId.get(id)
    if (!n) return 0
    const sz       = nodeSize(n.type)
    const children = kids(id)
    if (!children.length) { swById.set(id, sz.width); return sz.width }
    children.forEach(c => measure(c.id))
    const total = id === rootId ? symmetricRoot(children).totalWidth : childrenSpan(children)
    const sw    = Math.max(sz.width, total)
    swById.set(id, sw)
    return sw
  }
  measure(rootId)

  // 3. Place subtrees top-down
  const placements: AgentPlacement[] = []
  const connectors: AgentConnector[] = []
  const placed:     Record<string, AgentPlacement> = {}

  const place = (id: string, left: number) => {
    const n     = byId.get(id)
    const depth = depths.get(id)
    const sw    = swById.get(id)
    if (!n || depth === undefined || sw === undefined) return

    const sz = nodeSize(n.type)
    const x  = left + (sw - sz.width) / 2
    const y  = depthY[depth]
    const p: AgentPlacement = {
      node: n, x, y,
      width: sz.width, height: sz.height,
      centerX: x + sz.width / 2,
      bottomY: y + sz.height,
    }
    placements.push(p)
    placed[id] = p

    const children = kids(id)
    if (!children.length) return

    if (id === rootId) {
      const { centersById } = symmetricRoot(children)
      for (const c of children) {
        const cw  = swById.get(c.id) ?? 0
        const off = centersById.get(c.id) ?? 0
        place(c.id, p.centerX + off - cw / 2)
        const cp = placed[c.id]
        if (cp) connectors.push({ fromX: p.centerX, fromY: p.bottomY, toX: cp.centerX, toY: cp.y })
      }
    } else {
      const total  = childrenSpan(children)
      let   cursor = left + (sw - total) / 2
      for (let i = 0; i < children.length; i++) {
        const c  = children[i]
        const cw = swById.get(c.id) ?? 0
        place(c.id, cursor)
        const cp = placed[c.id]
        if (cp) connectors.push({ fromX: p.centerX, fromY: p.bottomY, toX: cp.centerX, toY: cp.y })
        cursor += cw
        if (i < children.length - 1) cursor += siblingGap(c, children[i + 1])
      }
    }
  }

  place(rootId, 0)

  return {
    placements,
    connectors,
    width:  swById.get(rootId) ?? GM_W,
    height: placements.reduce((max, p) => Math.max(max, p.bottomY), 0),
  }
}

// ─── Public: AgentNode[] → MapAgentNode[] ────────────────────────────────────

export function agentNodesToMapNodes(
  agentNodes: AgentNode[],
  connectedTeamIds: Set<string>,
): MapAgentNode[] {
  const teamOrder: string[] = []
  for (const a of agentNodes) {
    if (!teamOrder.includes(a.teamId)) teamOrder.push(a.teamId)
  }
  const paletteMap: Record<string, { ribbon: string; soft: string }> = {}
  teamOrder.forEach((tid, i) => { paletteMap[tid] = TEAM_PALETTE[i % TEAM_PALETTE.length] })

  const managerMap: Record<string, string> = {}
  for (const a of agentNodes) {
    if (a.role === 'manager') managerMap[a.teamId] = a.agentId
  }

  return agentNodes.map(a => {
    let type: 'general_manager' | 'senior_manager' | 'worker'
    let parentId: string | null = null

    if (a.role === 'manager' && a.teamParentId === null) {
      type = 'general_manager'
    } else if (a.role === 'manager') {
      type = 'senior_manager'
      parentId = managerMap[a.teamParentId!] ?? null
    } else {
      type = 'worker'
      parentId = managerMap[a.teamId] ?? null
    }

    const palette = paletteMap[a.teamId] ?? TEAM_PALETTE[0]
    return {
      id:              a.agentId,
      type,
      label:           a.teamName,
      provider:        a.provider,
      model:           a.model,
      workspaceId:     a.workspaceId,
      teamId:          a.teamId,
      teamName:        a.teamName,
      teamType:        a.teamType,
      teamDescription: a.teamDescription,
      parentId,
      ribbon:    palette.ribbon,
      soft:      palette.soft,
      connected: connectedTeamIds.has(a.teamId),
    }
  })
}

// ─── Public: full layout for multiple root trees ──────────────────────────────

export function buildAgentLayout(mapNodes: MapAgentNode[]): AgentLayoutResult {
  const roots = mapNodes.filter(n => n.parentId === null)
  if (!roots.length) return { placements: [], connectors: [], totalWidth: 0, totalHeight: 0 }

  const allPlacements: AgentPlacement[] = []
  const allConnectors: AgentConnector[] = []
  let   xOffset   = PAD_X
  let   maxHeight = 0

  for (const root of roots) {
    const ids     = getSubtreeIds(root.id, mapNodes)
    const subtree = mapNodes.filter(n => ids.has(n.id))
    const { placements, connectors, width, height } = buildSingleTree(root.id, subtree)

    for (const p of placements) {
      allPlacements.push({ ...p, x: p.x + xOffset, centerX: p.centerX + xOffset })
    }
    for (const c of connectors) {
      allConnectors.push({ fromX: c.fromX + xOffset, fromY: c.fromY, toX: c.toX + xOffset, toY: c.toY })
    }

    xOffset   += width + GAP_BETWEEN_ROOT_TREES
    maxHeight  = Math.max(maxHeight, height)
  }

  return {
    placements:  allPlacements,
    connectors:  allConnectors,
    totalWidth:  xOffset - GAP_BETWEEN_ROOT_TREES + PAD_X,
    totalHeight: maxHeight + PAD_Y * 2,
  }
}
