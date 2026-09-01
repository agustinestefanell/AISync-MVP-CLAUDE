/**
 * buildTreeLayout — Port literal desde preview validada
 *
 * Algoritmo de posicionamiento jerárquico para Teams Map v3
 * Soporta dos variantes: 'map' (expandido) y 'tree' (compacto)
 */

import type {
  TeamsGraphNode,
  TreeLayoutVariant,
  TreeLayoutResult,
  TreeLayoutPlacement,
  TreeLayoutConnector,
  TreeLayoutSize,
} from './teamsMapLayoutTypes'
import {
  MAP_ROOT_WIDTH,
  MAP_ROOT_HEIGHT,
  MAP_NODE_WIDTH,
  MAP_WORKER_WIDTH,
  MAP_SUB_MANAGER_HEIGHT,
  MAP_WORKER_HEIGHT,
  MAP_SHARED_TEAM_RIBBON_HEIGHT,
  MAP_LEVEL_GAP,
  MAP_SIBLING_GAP,
  MAP_FAMILY_BREAK_GAP,
  TREE_ROOT_WIDTH,
  TREE_ROOT_HEIGHT,
  TREE_NODE_WIDTH,
  TREE_WORKER_WIDTH,
  TREE_SUB_MANAGER_HEIGHT,
  TREE_WORKER_HEIGHT,
  TREE_LEVEL_GAP,
  TREE_SIBLING_GAP,
} from './teamsMapLayoutTypes'
import { getChildNodes } from './teamsMapLayoutHelpers'

function getNodeLayoutSize(node: TeamsGraphNode, variant: TreeLayoutVariant): TreeLayoutSize {
  if (variant === 'map') {
    if (node.type === 'general_manager') {
      return { width: MAP_ROOT_WIDTH, height: MAP_ROOT_HEIGHT }
    }

    if (node.type === 'worker') {
      return { width: MAP_WORKER_WIDTH, height: MAP_WORKER_HEIGHT }
    }

    return {
      width: MAP_NODE_WIDTH,
      height: node.isConnected ? MAP_SUB_MANAGER_HEIGHT + MAP_SHARED_TEAM_RIBBON_HEIGHT : MAP_SUB_MANAGER_HEIGHT,
    }
  }

  if (node.type === 'general_manager') {
    return { width: TREE_ROOT_WIDTH, height: TREE_ROOT_HEIGHT }
  }

  if (node.type === 'worker') {
    return { width: TREE_WORKER_WIDTH, height: TREE_WORKER_HEIGHT }
  }

  return { width: TREE_NODE_WIDTH, height: TREE_SUB_MANAGER_HEIGHT }
}

export function buildTreeLayout(
  rootNode: TeamsGraphNode,
  allNodes: TeamsGraphNode[],
  variant: TreeLayoutVariant,
): TreeLayoutResult {
  const levelGap = variant === 'map' ? MAP_LEVEL_GAP : TREE_LEVEL_GAP
  const siblingGap = variant === 'map' ? MAP_SIBLING_GAP : TREE_SIBLING_GAP
  const nodeById = new Map(allNodes.map((node) => [node.id, node]))
  const depthById = new Map<string, number>()
  const subtreeWidthById = new Map<string, number>()
  const levelHeights: number[] = []

  const getSiblingGapBetween = (leftChild: TeamsGraphNode, rightChild: TeamsGraphNode) => {
    if (variant !== 'map') {
      return siblingGap
    }

    if (leftChild.type !== rightChild.type) {
      return MAP_FAMILY_BREAK_GAP
    }

    return siblingGap
  }

  const getChildrenSpan = (children: TeamsGraphNode[]) => {
    if (children.length === 0) {
      return 0
    }

    return children.reduce((total, child, index) => {
      const childWidth = subtreeWidthById.get(child.id) ?? 0
      if (index === 0) {
        return childWidth
      }

      return total + getSiblingGapBetween(children[index - 1], child) + childWidth
    }, 0)
  }

  const getSymmetricRootChildrenLayout = (children: TeamsGraphNode[]) => {
    if (children.length === 0) {
      return {
        totalWidth: getNodeLayoutSize(rootNode, variant).width,
        centersById: new Map<string, number>(),
      }
    }

    const centersById = new Map<string, number>()
    const widths = children.map((child) => subtreeWidthById.get(child.id) ?? 0)
    const middleIndex = Math.floor(children.length / 2)

    if (children.length % 2 === 1) {
      centersById.set(children[middleIndex].id, 0)

      for (let index = middleIndex + 1; index < children.length; index += 1) {
        const previousCenter = centersById.get(children[index - 1].id) ?? 0
        const previousWidth = widths[index - 1]
        const currentWidth = widths[index]
        const gap = getSiblingGapBetween(children[index - 1], children[index])
        centersById.set(
          children[index].id,
          previousCenter + previousWidth / 2 + gap + currentWidth / 2,
        )
      }

      for (let index = middleIndex - 1; index >= 0; index -= 1) {
        const nextCenter = centersById.get(children[index + 1].id) ?? 0
        const currentWidth = widths[index]
        const nextWidth = widths[index + 1]
        const gap = getSiblingGapBetween(children[index], children[index + 1])
        centersById.set(
          children[index].id,
          nextCenter - nextWidth / 2 - gap - currentWidth / 2,
        )
      }
    } else {
      const leftCenterIndex = middleIndex - 1
      const rightCenterIndex = middleIndex
      const middleGap = getSiblingGapBetween(children[leftCenterIndex], children[rightCenterIndex])

      centersById.set(
        children[leftCenterIndex].id,
        -(middleGap / 2 + widths[leftCenterIndex] / 2),
      )
      centersById.set(
        children[rightCenterIndex].id,
        middleGap / 2 + widths[rightCenterIndex] / 2,
      )

      for (let index = rightCenterIndex + 1; index < children.length; index += 1) {
        const previousCenter = centersById.get(children[index - 1].id) ?? 0
        const previousWidth = widths[index - 1]
        const currentWidth = widths[index]
        const gap = getSiblingGapBetween(children[index - 1], children[index])
        centersById.set(
          children[index].id,
          previousCenter + previousWidth / 2 + gap + currentWidth / 2,
        )
      }

      for (let index = leftCenterIndex - 1; index >= 0; index -= 1) {
        const nextCenter = centersById.get(children[index + 1].id) ?? 0
        const currentWidth = widths[index]
        const nextWidth = widths[index + 1]
        const gap = getSiblingGapBetween(children[index], children[index + 1])
        centersById.set(
          children[index].id,
          nextCenter - nextWidth / 2 - gap - currentWidth / 2,
        )
      }
    }

    const halfSpan = children.reduce((max, child, index) => {
      const center = centersById.get(child.id) ?? 0
      const width = widths[index]
      return Math.max(max, Math.abs(center) + width / 2)
    }, 0)

    return {
      totalWidth: Math.max(getNodeLayoutSize(rootNode, variant).width, halfSpan * 2),
      centersById,
    }
  }

  // Depth assignment — a Manager's own Workers sit one level below it
  // (depth+1), its Sub-Teams sit two levels below (depth+2), so the two
  // groups never share a row. The depth+2 slot is reserved even when a
  // given Manager has 0 own Workers (that branch just skips depth+1 —
  // other Managers in the same tree may still occupy it, so global row
  // alignment across branches is preserved). Recursive: each Sub-Team is
  // itself a 'senior_manager' node, so it applies the same rule from its
  // own depth. The root ("Executive Team") is exempt — it never has
  // Workers of its own, so its children (the top-level Teams) go straight
  // to depth+1 with no row reserved before them.
  const assignDepths = (nodeId: string, depth: number) => {
    const node = nodeById.get(nodeId)
    if (!node) {
      return
    }

    depthById.set(nodeId, depth)
    const size = getNodeLayoutSize(node, variant)
    levelHeights[depth] = Math.max(levelHeights[depth] ?? 0, size.height)

    if (node.type === 'worker') {
      return
    }

    const children = getChildNodes(allNodes, nodeId)

    if (node.type === 'general_manager') {
      for (const child of children) {
        assignDepths(child.id, depth + 1)
      }
      return
    }

    for (const child of children) {
      if (child.type === 'worker') {
        assignDepths(child.id, depth + 1)
      }
    }
    for (const child of children) {
      if (child.type === 'senior_manager') {
        assignDepths(child.id, depth + 2)
      }
    }
  }

  assignDepths(rootNode.id, 0)

  // A depth reserved for a Manager's own Workers row can end up with no
  // node in it anywhere in the tree (e.g. every Manager with a Sub-Team
  // happens to have 0 own Workers) — that leaves a hole in levelHeights at
  // that index. Array methods like .reduce()/.forEach() SKIP holes in a
  // sparse array, so a plain reduce here would leave depthOffsets[depth]
  // as undefined and cascade into NaN for every depth below it. A plain
  // indexed for-loop visits every index regardless of holes, so treat a
  // hole as height 0 explicitly instead.
  const depthOffsets: number[] = []
  for (let index = 0; index < levelHeights.length; index += 1) {
    depthOffsets[index] =
      index === 0 ? 0 : depthOffsets[index - 1] + (levelHeights[index - 1] ?? 0) + levelGap
  }

  const measureSubtree = (nodeId: string): number => {
    const node = nodeById.get(nodeId)
    if (!node) {
      return 0
    }

    const size = getNodeLayoutSize(node, variant)
    const children = getChildNodes(allNodes, nodeId)

    if (children.length === 0) {
      subtreeWidthById.set(nodeId, size.width)
      return size.width
    }

    children.forEach((child) => {
      measureSubtree(child.id)
    })

    let totalChildrenWidth: number
    if (nodeId === rootNode.id) {
      totalChildrenWidth = getSymmetricRootChildrenLayout(children).totalWidth
    } else {
      // Own Workers row and Sub-Teams row are independent rows now (see
      // assignDepths) — the subtree's width is however wide the WIDER of
      // the two rows is, not their combined sum.
      const workerChildren = children.filter((child) => child.type === 'worker')
      const subteamChildren = children.filter((child) => child.type === 'senior_manager')
      totalChildrenWidth = Math.max(getChildrenSpan(workerChildren), getChildrenSpan(subteamChildren))
    }

    const subtreeWidth = Math.max(size.width, totalChildrenWidth)
    subtreeWidthById.set(nodeId, subtreeWidth)
    return subtreeWidth
  }

  measureSubtree(rootNode.id)

  const placements: TreeLayoutPlacement[] = []
  const connectors: TreeLayoutConnector[] = []
  const placementById: Record<string, TreeLayoutPlacement> = {}

  const placeSubtree = (nodeId: string, left: number) => {
    const node = nodeById.get(nodeId)
    const depth = depthById.get(nodeId)
    const subtreeWidth = subtreeWidthById.get(nodeId)

    if (!node || depth === undefined || subtreeWidth === undefined) {
      return
    }

    const size = getNodeLayoutSize(node, variant)
    const x = left + (subtreeWidth - size.width) / 2
    const y = depthOffsets[depth]
    const placement: TreeLayoutPlacement = {
      node,
      depth,
      x,
      y,
      width: size.width,
      height: size.height,
      centerX: x + size.width / 2,
      topY: y,
      bottomY: y + size.height,
      subtreeWidth,
    }

    placements.push(placement)
    placementById[nodeId] = placement

    const children = getChildNodes(allNodes, nodeId)
    if (children.length === 0) {
      return
    }

    if (nodeId === rootNode.id) {
      const { centersById } = getSymmetricRootChildrenLayout(children)

      children.forEach((child) => {
        const childWidth = subtreeWidthById.get(child.id) ?? 0
        const childCenterOffset = centersById.get(child.id) ?? 0
        const childLeft = placement.centerX + childCenterOffset - childWidth / 2
        placeSubtree(child.id, childLeft)

        const childPlacement = placementById[child.id]
        if (childPlacement) {
          connectors.push({
            parentId: nodeId,
            childId: child.id,
            fromX: placement.centerX,
            fromY: placement.bottomY,
            toX: childPlacement.centerX,
            toY: childPlacement.topY,
          })
        }
      })

      return
    }

    // Own Workers and Sub-Teams are two independent rows now (see
    // assignDepths) — each is centered on this node's centerX on its own,
    // instead of being strung together left-to-right in one combined row.
    const placeRow = (rowChildren: TeamsGraphNode[]) => {
      if (rowChildren.length === 0) {
        return
      }

      const rowWidth = getChildrenSpan(rowChildren)
      let rowCursor = placement.centerX - rowWidth / 2

      rowChildren.forEach((child, index) => {
        const childWidth = subtreeWidthById.get(child.id) ?? 0
        placeSubtree(child.id, rowCursor)

        const childPlacement = placementById[child.id]
        if (childPlacement) {
          connectors.push({
            parentId: nodeId,
            childId: child.id,
            fromX: placement.centerX,
            fromY: placement.bottomY,
            toX: childPlacement.centerX,
            toY: childPlacement.topY,
          })
        }

        rowCursor += childWidth
        if (index < rowChildren.length - 1) {
          rowCursor += getSiblingGapBetween(child, rowChildren[index + 1])
        }
      })
    }

    placeRow(children.filter((child) => child.type === 'worker'))
    placeRow(children.filter((child) => child.type === 'senior_manager'))
  }

  placeSubtree(rootNode.id, 0)

  const totalWidth = subtreeWidthById.get(rootNode.id) ?? getNodeLayoutSize(rootNode, variant).width
  const deepestBottom = placements.reduce((max, placement) => Math.max(max, placement.bottomY), 0)

  return {
    width: totalWidth,
    height: deepestBottom,
    placements,
    placementById,
    connectors,
  }
}
