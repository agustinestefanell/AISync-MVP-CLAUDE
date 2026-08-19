import type { TeamWithWorkspaces } from '@/lib/db/types'

// Extraído de MapView.tsx (Teams Map) — misma función, movida a un módulo
// compartido para que Documentation Mode (DocClient.tsx) pueda reusarla antes
// de computeTeamCodes() sin reimplementar el filtro. Ver handoff-2026-07-b.md
// 2026-08-19 (Fase 2 — fix de código de team inconsistente).
//
// Si un padre está archivado y oculto, sus hijos también se ocultan — evita
// nodos huérfanos.
export function filterArchivedTeams(
  teams: TeamWithWorkspaces[],
  showArchived: boolean,
): TeamWithWorkspaces[] {
  if (showArchived) return teams

  const activeTeams = teams.filter(t => t.status !== 'archived')
  const activeIds = new Set(activeTeams.map(t => t.id))

  return activeTeams.filter(team => {
    if (!team.parent_id) return true
    return activeIds.has(team.parent_id)
  })
}
