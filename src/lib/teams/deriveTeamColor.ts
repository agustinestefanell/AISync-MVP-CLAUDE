/**
 * deriveTeamColor — Color derivation utilities for Teams Map
 *
 * - team.color is the primary visual identity (if present)
 * - Subteam color is derived as a lighter tone of parent team color
 * - Fallback color is deterministic per team.id if team.color is null
 */

/**
 * Derives a lighter color from a given hex color.
 * Mixes the input color with white to create a lighter tone.
 *
 * @param hexColor - Base color in hex format (e.g., "#8E4CC6")
 * @param lightenAmount - Amount to lighten (0-1), default 0.4
 * @returns Lighter hex color
 */
export function deriveLighterColor(hexColor: string, lightenAmount = 0.4): string {
  // Validate hex format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return '#E2E8F0' // Fallback light gray if invalid
  }

  // Parse RGB
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  // Mix with white (255, 255, 255)
  const newR = Math.round(r + (255 - r) * lightenAmount)
  const newG = Math.round(g + (255 - g) * lightenAmount)
  const newB = Math.round(b + (255 - b) * lightenAmount)

  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`
}

/**
 * Generates a fallback color deterministically based on a seed string.
 * Used when team.color is null.
 *
 * @param seed - Unique identifier (e.g., team.id)
 * @returns Hex color from predefined palette
 */
export function getFallbackTeamColor(seed: string): string {
  // Palette of distinct colors for visual differentiation
  const palette = [
    '#8E4CC6', // Purple
    '#6A55C7', // Violet
    '#3B82C4', // Blue
    '#40AEA8', // Teal
    '#59AA73', // Green
    '#F3B72F', // Yellow
    '#FF8C43', // Orange
    '#F05463', // Red
  ]

  // Simple hash from seed string
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }

  const index = Math.abs(hash) % palette.length
  return palette[index]
}
