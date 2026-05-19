export type ProjectNodeType = 'gm' | 'team' | 'subteam' | 'worker'

export interface ProjectColorTokens {
  bg:     string
  header: string
  border: string
  badge:  string
  accent: string
}

// ─── 12 Corporate Palettes ────────────────────────────────────────────────────

export const CORPORATE_PALETTES = [
  {
    name: 'Corporate Navy',
    base: '#1E3A5F',
    gmHeader: '#DCE6F1',
    team1: '#2F5277',
    subteam: '#AFC3D4',
    background: '#F4F7FA',
  },
  {
    name: 'Slate Blue Gray',
    base: '#334155',
    gmHeader: '#E2E8F0',
    team1: '#475569',
    subteam: '#CBD5E1',
    background: '#F8FAFC',
  },
  {
    name: 'Deep Teal',
    base: '#174E4F',
    gmHeader: '#DDEEEE',
    team1: '#256A6B',
    subteam: '#B7D4D3',
    background: '#F3FAF9',
  },
  {
    name: 'Muted Forest',
    base: '#2F5233',
    gmHeader: '#E1EBE2',
    team1: '#426A45',
    subteam: '#C5D4C3',
    background: '#F6FAF5',
  },
  {
    name: 'Charcoal Olive',
    base: '#3F4631',
    gmHeader: '#E7EADF',
    team1: '#566044',
    subteam: '#CDD2BF',
    background: '#FAFAF5',
  },
  {
    name: 'Warm Graphite',
    base: '#3E3A36',
    gmHeader: '#E9E5E1',
    team1: '#57504A',
    subteam: '#D1CBC4',
    background: '#FAF8F6',
  },
  {
    name: 'Burgundy Corporate',
    base: '#5A2630',
    gmHeader: '#F0E1E4',
    team1: '#743643',
    subteam: '#D9B9C0',
    background: '#FCF7F8',
  },
  {
    name: 'Muted Plum',
    base: '#4B3A57',
    gmHeader: '#E8E1EC',
    team1: '#604B6F',
    subteam: '#CABDD1',
    background: '#FAF7FC',
  },
  {
    name: 'Steel Cyan',
    base: '#28566B',
    gmHeader: '#DDEBF0',
    team1: '#3B6D82',
    subteam: '#BBD3DC',
    background: '#F5FAFC',
  },
  {
    name: 'Sandstone Executive',
    base: '#6B5635',
    gmHeader: '#EFE7D8',
    team1: '#826B45',
    subteam: '#D8C9AD',
    background: '#FCFAF5',
  },
  {
    name: 'Desaturated Indigo',
    base: '#373A6B',
    gmHeader: '#E1E3F1',
    team1: '#4A4E82',
    subteam: '#BFC2DC',
    background: '#F7F8FC',
  },
  {
    name: 'Corporate Rust',
    base: '#70422F',
    gmHeader: '#F0E3DD',
    team1: '#87523D',
    subteam: '#D8BEB3',
    background: '#FCF8F6',
  },
] as const

// ─── Index derivation ─────────────────────────────────────────────────────────

/**
 * Derives a stable palette index from a hierarchical team code.
 *
 * Rule: the second segment encodes the palette slot.
 *   A-00       → 0  (GM, always Corporate Navy)
 *   A-01       → 1
 *   A-02       → 2
 *   A-01-01    → 1  (subteam inherits via second segment)
 *   A-01-02    → 1
 *   A-02-01    → 2
 *   A-12       → 0  (12 mod 12, wraps around)
 */
export function teamCodeToPaletteIndex(teamCode: string): number {
  const parts = teamCode.split('-')
  if (parts.length < 2) return 0
  const n = parseInt(parts[1], 10)
  return isNaN(n) ? 0 : n % CORPORATE_PALETTES.length
}

// ─── Token resolution ─────────────────────────────────────────────────────────

export function getProjectColorTokens(
  projectIndex: number,
  nodeType: ProjectNodeType,
): ProjectColorTokens {
  const p = CORPORATE_PALETTES[Math.abs(projectIndex) % CORPORATE_PALETTES.length]

  switch (nodeType) {
    case 'gm':
      return {
        bg:     p.background,
        header: p.gmHeader,
        border: p.base,
        badge:  p.base,
        accent: p.base,
      }
    case 'team':
      return {
        bg:     p.background,
        header: p.gmHeader,
        border: p.team1,
        badge:  p.base,
        accent: p.base,
      }
    case 'subteam':
      return {
        bg:     p.background,
        header: p.background,
        border: p.subteam,
        badge:  p.base,
        accent: p.subteam,
      }
    case 'worker':
      return {
        bg:     '#FFFFFF',
        header: '#F8FAFC',
        border: '#E5E7EB',
        badge:  '#94a3b8',
        accent: p.base,
      }
  }
}
