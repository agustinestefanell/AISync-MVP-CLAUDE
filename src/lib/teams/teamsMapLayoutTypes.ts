/**
 * Teams Map Layout Types — Port literal desde preview validada
 *
 * Tipos de layout para algoritmo de árbol jerárquico
 */

export type TeamNodeType = 'general_manager' | 'senior_manager' | 'worker'
export type TeamType = 'SAT' | 'MAT'
export type AIProvider = 'OpenAI' | 'Anthropic' | 'Google'

export interface TeamsGraphNode {
  id: string
  type: TeamNodeType
  label: string
  provider: AIProvider
  parentId: string | null
  teamId: string
  teamType: TeamType
  isConnected?: boolean // Mark connected/shared teams for visual differentiation
  connectionRole?: 'host' | 'invitee'
  partnerEmail?: string
  partnerOrg?: string
}

export interface TeamTheme {
  ribbon: string
  soft: string
  border: string
  accent: string
}

export type TreeLayoutVariant = 'map' | 'tree'

export interface TreeLayoutSize {
  width: number
  height: number
}

export interface TreeLayoutPlacement {
  node: TeamsGraphNode
  depth: number
  x: number
  y: number
  width: number
  height: number
  centerX: number
  topY: number
  bottomY: number
  subtreeWidth: number
}

export interface TreeLayoutConnector {
  parentId: string
  childId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface TreeLayoutResult {
  width: number
  height: number
  placements: TreeLayoutPlacement[]
  placementById: Record<string, TreeLayoutPlacement>
  connectors: TreeLayoutConnector[]
}

// Layout constants from demo — MAP variant
export const MAP_ROOT_WIDTH = 760
export const MAP_ROOT_HEIGHT = 260  // Increased from 212 to prevent Executive Team text cutoff
export const MAP_NODE_WIDTH = 356
export const MAP_WORKER_WIDTH = 316
export const MAP_SUB_MANAGER_HEIGHT = 364
export const MAP_WORKER_HEIGHT = 312
export const MAP_LEVEL_GAP = 140
export const MAP_SIBLING_GAP = 92
export const MAP_FAMILY_BREAK_GAP = 176
export const MAP_CANVAS_PADDING_X = 128
export const MAP_CANVAS_PADDING_Y = 80  // Increased from 40 to add top margin for Executive Team card

// Layout constants from demo — TREE variant
export const TREE_ROOT_WIDTH = 112
export const TREE_ROOT_HEIGHT = 84
export const TREE_NODE_WIDTH = 152
export const TREE_WORKER_WIDTH = 112
export const TREE_SUB_MANAGER_HEIGHT = 120
export const TREE_WORKER_HEIGHT = 86
export const TREE_AUX_NODE_WIDTH = 116
export const TREE_AUX_NODE_HEIGHT = 96
export const TREE_LEVEL_GAP = 74
export const TREE_SIBLING_GAP = 44
export const TREE_CANVAS_PADDING_X = 76
export const TREE_CANVAS_PADDING_Y = 18
