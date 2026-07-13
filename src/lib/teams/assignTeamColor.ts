/**
 * assignTeamColor — Fallback color assignment for teams
 *
 * When team.color is null, provides a deterministic fallback
 * color from a palette based on team.id hash.
 */

const FALLBACK_PALETTE = [
  '#8E4CC6', // Purple
  '#6A55C7', // Violet
  '#6E65C8', // Violet-blue
  '#2795C7', // Blue
  '#3B82C4', // Medium blue
  '#40AEA8', // Teal
  '#59AA73', // Green
  '#6CB77E', // Light green
  '#F5B82E', // Yellow
  '#F3B72F', // Gold
  '#FF8C43', // Orange
]

/**
 * Resolves the visual color for a team.
 *
 * @param team - Team object with id and color
 * @returns Hex color string
 */
export function resolveTeamColor(team: { id: string; color: string | null }): string {
  if (team.color) return team.color

  // Deterministic hash from team.id
  let hash = 0
  for (const char of team.id) {
    hash = (hash * 31 + char.charCodeAt(0)) % FALLBACK_PALETTE.length
  }

  return FALLBACK_PALETTE[hash]
}
