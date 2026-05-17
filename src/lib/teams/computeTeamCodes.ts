import type { TeamWithWorkspaces } from '@/lib/db/types'

function projectLetter(i: number): string {
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (i < 26) return base[i]
  return base[Math.floor(i / 26) - 1] + base[i % 26]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function assignChildren(
  parentId:  string,
  prefix:    string,
  allSorted: TeamWithWorkspaces[],
  codes:     Record<string, string>,
): void {
  const children = allSorted.filter(t => t.parent_id === parentId)
  children.forEach((child, i) => {
    const code = `${prefix}-${pad2(i + 1)}`
    codes[child.id] = code
    assignChildren(child.id, code, allSorted, codes)
  })
}

/**
 * Derives a stable hierarchical code for every team in the array.
 *
 * Format:
 *   A-00          root (general manager)
 *   A-01, A-02    direct children, ordered by created_at
 *   A-01-01       grandchildren, same rule
 *   B-00          second root, and so on
 *
 * Order is always by created_at ascending — never alphabetical.
 * No DB writes. Pure client-side derivation.
 */
export function computeTeamCodes(
  teams: TeamWithWorkspaces[],
): Record<string, string> {
  const codes: Record<string, string> = {}

  const sorted = [...teams].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const roots = sorted.filter(t => t.parent_id === null)

  roots.forEach((root, rootIdx) => {
    const letter = projectLetter(rootIdx)
    codes[root.id] = `${letter}-00`
    assignChildren(root.id, letter, sorted, codes)
  })

  return codes
}
