import type { MapAgentNode } from './buildAgentLayout'

// ─── Types (direct port of demo's PageD.tsx) ─────────────────────────────────

export type TreeLayoutPlacement = {
  node:         MapAgentNode
  depth:        number
  x:            number
  y:            number
  width:        number
  height:       number
  centerX:      number
  topY:         number
  bottomY:      number
  subtreeWidth: number
}

export type TreeLayoutConnector = {
  parentId: string
  childId:  string
  fromX:    number
  fromY:    number
  toX:      number
  toY:      number
}

export type TreeLayoutResult = {
  width:         number
  height:        number
  placements:    TreeLayoutPlacement[]
  placementById: Record<string, TreeLayoutPlacement>
  connectors:    TreeLayoutConnector[]
}

// ─── Constants (exact demo values, MAP mode) ──────────────────────────────────

const MAP_ROOT_WIDTH        = 760
const MAP_ROOT_HEIGHT       = 212
const MAP_NODE_WIDTH        = 356
const MAP_SUB_MANAGER_HEIGHT = 364
const MAP_WORKER_WIDTH      = 316
const MAP_WORKER_HEIGHT     = 312
const MAP_LEVEL_GAP         = 140
const MAP_SIBLING_GAP       = 30
const MAP_FAMILY_BREAK_GAP  = 50

export const MAP_CANVAS_PADDING_X   = 128
export const MAP_CANVAS_PADDING_Y   = 40
export const GAP_BETWEEN_ROOT_TREES = 20 // logical gap; visual card-to-card max ≈ 56px (20 + 2×18 slack)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeLayoutSize(node: MapAgentNode): { width: number; height: number } {
  if (node.type === 'general_manager') return { width: MAP_ROOT_WIDTH,   height: MAP_ROOT_HEIGHT }
  if (node.type === 'worker')          return { width: MAP_WORKER_WIDTH, height: MAP_WORKER_HEIGHT }
  return                                      { width: MAP_NODE_WIDTH,   height: MAP_SUB_MANAGER_HEIGHT }
}

const TYPE_ORDER = { general_manager: 0, senior_manager: 1, worker: 2 } as const

function getChildNodes(allNodes: MapAgentNode[], parentId: string): MapAgentNode[] {
  return allNodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3))
}

function getSiblingGapBetween(left: MapAgentNode, right: MapAgentNode): number {
  return left.type !== right.type ? MAP_FAMILY_BREAK_GAP : MAP_SIBLING_GAP
}

function getChildrenSpan(
  children: MapAgentNode[],
  subtreeWidthById: Map<string, number>,
): number {
  if (children.length === 0) return 0
  return children.reduce((total, child, i) => {
    const childWidth = subtreeWidthById.get(child.id) ?? 0
    if (i === 0) return childWidth
    return total + getSiblingGapBetween(children[i - 1], child) + childWidth
  }, 0)
}

function getSymmetricRootChildrenLayout(
  rootNode: MapAgentNode,
  children: MapAgentNode[],
  subtreeWidthById: Map<string, number>,
): { totalWidth: number; centersById: Map<string, number> } {
  if (children.length === 0) {
    return { totalWidth: getNodeLayoutSize(rootNode).width, centersById: new Map() }
  }

  const centersById = new Map<string, number>()
  const widths      = children.map(c => subtreeWidthById.get(c.id) ?? 0)
  const midIdx      = Math.floor(children.length / 2)

  if (children.length % 2 === 1) {
    centersById.set(children[midIdx].id, 0)

    for (let i = midIdx + 1; i < children.length; i++) {
      const prev = centersById.get(children[i - 1].id) ?? 0
      const gap  = getSiblingGapBetween(children[i - 1], children[i])
      centersById.set(children[i].id, prev + widths[i - 1] / 2 + gap + widths[i] / 2)
    }

    for (let i = midIdx - 1; i >= 0; i--) {
      const next = centersById.get(children[i + 1].id) ?? 0
      const gap  = getSiblingGapBetween(children[i], children[i + 1])
      centersById.set(children[i].id, next - widths[i + 1] / 2 - gap - widths[i] / 2)
    }
  } else {
    const lm  = midIdx - 1
    const rm  = midIdx
    const mg  = getSiblingGapBetween(children[lm], children[rm])
    centersById.set(children[lm].id, -(mg / 2 + widths[lm] / 2))
    centersById.set(children[rm].id,   mg / 2 + widths[rm] / 2)

    for (let i = rm + 1; i < children.length; i++) {
      const prev = centersById.get(children[i - 1].id) ?? 0
      const gap  = getSiblingGapBetween(children[i - 1], children[i])
      centersById.set(children[i].id, prev + widths[i - 1] / 2 + gap + widths[i] / 2)
    }

    for (let i = lm - 1; i >= 0; i--) {
      const next = centersById.get(children[i + 1].id) ?? 0
      const gap  = getSiblingGapBetween(children[i], children[i + 1])
      centersById.set(children[i].id, next - widths[i + 1] / 2 - gap - widths[i] / 2)
    }
  }

  const halfSpan = children.reduce((max, child, i) => {
    const center = centersById.get(child.id) ?? 0
    return Math.max(max, Math.abs(center) + widths[i] / 2)
  }, 0)

  return {
    totalWidth: Math.max(getNodeLayoutSize(rootNode).width, halfSpan * 2),
    centersById,
  }
}

// ─── Main export (exact port of demo buildTreeLayout, MAP variant only) ───────

export function buildTreeLayout(
  rootNode: MapAgentNode,
  allNodes: MapAgentNode[],
): TreeLayoutResult {
  const nodeById         = new Map(allNodes.map(n => [n.id, n]))
  const depthById        = new Map<string, number>()
  const subtreeWidthById = new Map<string, number>()
  const levelHeights: number[] = []

  // Phase 1: assign depths
  const assignDepths = (nodeId: string, depth: number) => {
    const node = nodeById.get(nodeId)
    if (!node) return
    depthById.set(nodeId, depth)
    const size = getNodeLayoutSize(node)
    levelHeights[depth] = Math.max(levelHeights[depth] ?? 0, size.height)
    for (const child of getChildNodes(allNodes, nodeId)) assignDepths(child.id, depth + 1)
  }
  assignDepths(rootNode.id, 0)

  const depthOffsets = levelHeights.reduce<number[]>((acc, _h, i) => {
    acc[i] = i === 0 ? 0 : acc[i - 1] + levelHeights[i - 1] + MAP_LEVEL_GAP
    return acc
  }, [])

  // Phase 2: measure subtree widths (bottom-up)
  const measureSubtree = (nodeId: string): number => {
    const node = nodeById.get(nodeId)
    if (!node) return 0
    const size     = getNodeLayoutSize(node)
    const children = getChildNodes(allNodes, nodeId)
    if (children.length === 0) {
      subtreeWidthById.set(nodeId, size.width)
      return size.width
    }
    children.forEach(c => measureSubtree(c.id))
    const totalW =
      nodeId === rootNode.id
        ? getSymmetricRootChildrenLayout(rootNode, children, subtreeWidthById).totalWidth
        : getChildrenSpan(children, subtreeWidthById)
    const sw = Math.max(size.width, totalW)
    subtreeWidthById.set(nodeId, sw)
    return sw
  }
  measureSubtree(rootNode.id)

  // Phase 3: place subtrees (top-down)
  const placements:    TreeLayoutPlacement[]               = []
  const connectors:    TreeLayoutConnector[]               = []
  const placementById: Record<string, TreeLayoutPlacement> = {}

  const placeSubtree = (nodeId: string, left: number) => {
    const node         = nodeById.get(nodeId)
    const depth        = depthById.get(nodeId)
    const subtreeWidth = subtreeWidthById.get(nodeId)
    if (!node || depth === undefined || subtreeWidth === undefined) return

    const size = getNodeLayoutSize(node)
    const x    = left + (subtreeWidth - size.width) / 2
    const y    = depthOffsets[depth]
    const p: TreeLayoutPlacement = {
      node, depth, x, y,
      width:        size.width,
      height:       size.height,
      centerX:      x + size.width / 2,
      topY:         y,
      bottomY:      y + size.height,
      subtreeWidth,
    }
    placements.push(p)
    placementById[nodeId] = p

    const children = getChildNodes(allNodes, nodeId)
    if (children.length === 0) return

    if (nodeId === rootNode.id) {
      const { centersById } = getSymmetricRootChildrenLayout(rootNode, children, subtreeWidthById)
      children.forEach(child => {
        const cw  = subtreeWidthById.get(child.id) ?? 0
        const off = centersById.get(child.id) ?? 0
        placeSubtree(child.id, p.centerX + off - cw / 2)
        const cp = placementById[child.id]
        if (cp) connectors.push({ parentId: nodeId, childId: child.id, fromX: p.centerX, fromY: p.bottomY, toX: cp.centerX, toY: cp.topY })
      })
    } else {
      const totalW  = getChildrenSpan(children, subtreeWidthById)
      let   cursor  = left + (subtreeWidth - totalW) / 2
      children.forEach((child, i) => {
        const cw = subtreeWidthById.get(child.id) ?? 0
        placeSubtree(child.id, cursor)
        const cp = placementById[child.id]
        if (cp) connectors.push({ parentId: nodeId, childId: child.id, fromX: p.centerX, fromY: p.bottomY, toX: cp.centerX, toY: cp.topY })
        cursor += cw
        if (i < children.length - 1) cursor += getSiblingGapBetween(child, children[i + 1])
      })
    }
  }
  placeSubtree(rootNode.id, 0)

  const totalWidth    = subtreeWidthById.get(rootNode.id) ?? getNodeLayoutSize(rootNode).width
  const deepestBottom = placements.reduce((max, p) => Math.max(max, p.bottomY), 0)

  return { width: totalWidth, height: deepestBottom, placements, placementById, connectors }
}
