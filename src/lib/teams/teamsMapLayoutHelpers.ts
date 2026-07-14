/**
 * Teams Map Layout Helpers — Port literal desde preview validada
 *
 * Helpers de color y sorting extraídos de la demo
 */

import type {
  TeamsGraphNode,
  TeamTheme,
  AIProvider,
} from './teamsMapLayoutTypes'

// Team themes — port literal desde demo teams.ts
export function getTeamTheme(teamId: string): TeamTheme {
  if (teamId === 'team_legal') {
    return {
      ribbon: '#7f2630',
      soft: 'rgba(127, 38, 48, 0.08)',
      border: 'rgba(127, 38, 48, 0.22)',
      accent: '#6f1f29',
    }
  }

  if (teamId === 'team_marketing') {
    return {
      ribbon: '#2d5f98',
      soft: 'rgba(45, 95, 152, 0.08)',
      border: 'rgba(45, 95, 152, 0.22)',
      accent: '#254f80',
    }
  }

  if (teamId === 'team_clients') {
    return {
      ribbon: '#25685f',
      soft: 'rgba(37, 104, 95, 0.08)',
      border: 'rgba(37, 104, 95, 0.22)',
      accent: '#1f5952',
    }
  }

  // Dynamic teams — rotativo con paleta ampliada
  const DYNAMIC_TEAM_THEMES: TeamTheme[] = [
    {
      ribbon: '#5b4b8a', // violeta
      soft: 'rgba(91, 75, 138, 0.08)',
      border: 'rgba(91, 75, 138, 0.22)',
      accent: '#4f3f7b',
    },
    {
      ribbon: '#8a4f24', // marrón
      soft: 'rgba(138, 79, 36, 0.08)',
      border: 'rgba(138, 79, 36, 0.22)',
      accent: '#74411c',
    },
    {
      ribbon: '#2f6b57', // verde oscuro
      soft: 'rgba(47, 107, 87, 0.08)',
      border: 'rgba(47, 107, 87, 0.22)',
      accent: '#295c4b',
    },
    {
      ribbon: '#8E4CC6', // púrpura
      soft: 'rgba(142, 76, 198, 0.08)',
      border: 'rgba(142, 76, 198, 0.22)',
      accent: '#7A3FB0',
    },
    {
      ribbon: '#2F78C4', // azul
      soft: 'rgba(47, 120, 196, 0.08)',
      border: 'rgba(47, 120, 196, 0.22)',
      accent: '#2563A8',
    },
    {
      ribbon: '#2F9C5B', // verde
      soft: 'rgba(47, 156, 91, 0.08)',
      border: 'rgba(47, 156, 91, 0.22)',
      accent: '#25804B',
    },
    {
      ribbon: '#E66A00', // naranja
      soft: 'rgba(230, 106, 0, 0.08)',
      border: 'rgba(230, 106, 0, 0.22)',
      accent: '#C45900',
    },
    {
      ribbon: '#D62E68', // rosa
      soft: 'rgba(214, 46, 104, 0.08)',
      border: 'rgba(214, 46, 104, 0.22)',
      accent: '#B82555',
    },
  ]

  // Hash simple del teamId para distribuir colores de manera determinista
  const hash = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const dynamicIndex = hash % DYNAMIC_TEAM_THEMES.length
  return DYNAMIC_TEAM_THEMES[dynamicIndex] ?? DYNAMIC_TEAM_THEMES[0]
}

// getFamilyColor — port literal desde demo
export function getFamilyColor(color: string, alpha: number) {
  const normalized = color.replace('#', '').trim()
  if (![3, 6].includes(normalized.length)) {
    return color
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalized
  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

// Provider display name
export function getProviderDisplayName(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider
}

// Sort nodes — port literal desde demo
export function sortNodesForDisplay(nodes: TeamsGraphNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'senior_manager' ? -1 : 1
    }

    return left.label.localeCompare(right.label)
  })
}

// Get child nodes
export function getChildNodes(teamNodes: TeamsGraphNode[], parentId: string) {
  return sortNodesForDisplay(teamNodes.filter((node) => node.parentId === parentId))
}

// Get branch leaf count
export function getBranchLeafCount(teamNodes: TeamsGraphNode[], nodeId: string): number {
  const children = getChildNodes(teamNodes, nodeId)
  if (children.length === 0) {
    return 1
  }

  return children.reduce((total, child) => total + getBranchLeafCount(teamNodes, child.id), 0)
}
