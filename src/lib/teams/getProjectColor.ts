// Generative project color system for Teams MAP.
// Color = Project membership. Intensity = hierarchy. SAT/MAT = badges only, not color.
// projectIndex derives from the same root order used by computeTeamCodes (A=0, B=1, …).

export type ProjectNodeType = 'gm' | 'team' | 'subteam' | 'worker'

export interface ProjectColorTokens {
  bg:     string // Card / section background (very light tint)
  header: string // Header strip color (medium tint)
  border: string // Card border / divider color
  badge:  string // Text color for labels, code badges
  accent: string // Accent for tags, descriptions, interactive elements
}

export function getProjectColorTokens(
  projectIndex: number,
  nodeType: ProjectNodeType,
): ProjectColorTokens {
  const h = Math.round((220 + projectIndex * 137.508) % 360)

  switch (nodeType) {
    case 'gm':
      return {
        bg:     `hsl(${h},40%,94%)`,
        header: `hsl(${h},55%,82%)`,
        border: `hsl(${h},65%,50%)`,
        badge:  `hsl(${h},70%,35%)`,
        accent: `hsl(${h},65%,45%)`,
      }
    case 'team':
      return {
        bg:     `hsl(${h},30%,95%)`,
        header: `hsl(${h},50%,86%)`,
        border: `hsl(${h},55%,62%)`,
        badge:  `hsl(${h},60%,42%)`,
        accent: `hsl(${h},55%,48%)`,
      }
    case 'subteam':
      return {
        bg:     `hsl(${h},20%,96%)`,
        header: `hsl(${h},35%,90%)`,
        border: `hsl(${h},40%,76%)`,
        badge:  `hsl(${h},45%,55%)`,
        accent: `hsl(${h},40%,58%)`,
      }
    case 'worker':
      return {
        bg:     'rgba(255,255,255,0.97)',
        header: `hsl(${h},12%,93%)`,
        border: 'rgba(203,213,225,0.65)',
        badge:  `hsl(${h},26%,58%)`,
        accent: `hsl(${h},34%,48%)`,
      }
  }
}
