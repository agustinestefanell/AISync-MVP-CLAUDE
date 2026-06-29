/**
 * Helpers for team_connections dual-read during Etapas 3-7
 * Part of Connected Teams correction plan (see DECISIONS.md 2026-06-26)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gets the isolated team ID for the host (requester) side of a connection.
 *
 * Dual-read logic (Etapas 3-7):
 * - Try host_isolated_team_id first (new architecture)
 * - Fall back to scope_isolated_team_id (legacy architecture)
 *
 * After Etapa 8, this becomes: return connection.host_isolated_team_id
 */
export function getHostIsolatedTeamId(connection: {
  host_isolated_team_id?: string | null
  scope_isolated_team_id?: string | null
}): string | null {
  return connection.host_isolated_team_id || connection.scope_isolated_team_id || null
}

/**
 * Gets the isolated team ID for the invitee (receiver) side of a connection.
 *
 * Dual-read logic (Etapas 3-7):
 * - Try invitee_isolated_team_id first (new architecture)
 * - Fall back to scope_isolated_team_id (legacy architecture - SHARED team, incorrect but necessary for old connections)
 *
 * After Etapa 8, this becomes: return connection.invitee_isolated_team_id
 */
export function getInviteeIsolatedTeamId(connection: {
  invitee_isolated_team_id?: string | null
  scope_isolated_team_id?: string | null
}): string | null {
  return connection.invitee_isolated_team_id || connection.scope_isolated_team_id || null
}

/**
 * Gets the isolated team ID for the current user's side of a connection.
 *
 * @param connection - The connection object
 * @param currentUserId - The current user's account ID
 * @returns The team ID for the current user's side (host or invitee)
 */
export function getUserIsolatedTeamId(
  connection: {
    requester_account_id: string
    receiver_account_id?: string | null
    host_isolated_team_id?: string | null
    invitee_isolated_team_id?: string | null
    scope_isolated_team_id?: string | null
  },
  currentUserId: string
): string | null {
  const isHost = connection.requester_account_id === currentUserId
  return isHost
    ? getHostIsolatedTeamId(connection)
    : getInviteeIsolatedTeamId(connection)
}

/**
 * Gets the isolated workspace ID for the current user's side of a connection.
 *
 * Dual-read logic (Etapas 3-7):
 * - For host: prefer host_isolated_team.workspaces[0].id, fallback to scope legacy
 * - For invitee: prefer invitee_isolated_team.workspaces[0].id, fallback to scope legacy
 *
 * After Etapa 8, remove scope_isolated_* fallbacks.
 *
 * @param connection - The connection object with isolated team joins
 * @param currentUserId - The current user's account ID
 * @returns The workspace ID for the current user's side (host or invitee)
 */
export function getUserIsolatedWorkspaceId(
  connection: {
    requester_account_id: string
    receiver_account_id?: string | null
    host_isolated_team?: { workspaces?: { id: string }[] } | null
    invitee_isolated_team?: { workspaces?: { id: string }[] } | null
    scope_isolated_team?: { workspaces?: { id: string }[] } | null
    scope_isolated_workspace_id?: string | null
  },
  currentUserId: string
): string | null {
  const isHost = connection.requester_account_id === currentUserId

  if (isHost) {
    // Host: prefer host_isolated_team.workspaces[0].id, fallback to scope
    return (
      connection.host_isolated_team?.workspaces?.[0]?.id ??
      connection.scope_isolated_team?.workspaces?.[0]?.id ??
      connection.scope_isolated_workspace_id ??
      null
    )
  } else {
    // Invitee: prefer invitee_isolated_team.workspaces[0].id, fallback to scope
    return (
      connection.invitee_isolated_team?.workspaces?.[0]?.id ??
      connection.scope_isolated_team?.workspaces?.[0]?.id ??
      connection.scope_isolated_workspace_id ??
      null
    )
  }
}

/**
 * Extended select string for team_connections that includes both new and legacy fields.
 *
 * Use this in all queries that need isolated team data during Etapas 3-7.
 * After Etapa 8, remove scope_isolated_team and references to scope_isolated_team_id.
 */
export const CONNECTIONS_SELECT_WITH_ISOLATED_TEAMS = '*, description, color, scope_isolated_workspace_id, scope_isolated_team:scope_isolated_team_id(workspaces(id)), host_isolated_team:host_isolated_team_id(workspaces(id)), invitee_isolated_team:invitee_isolated_team_id(workspaces(id))'

/**
 * Gets isolated team IDs visible to the current user from connections.
 *
 * For host: returns host_isolated_team_id (or scope_isolated_team_id fallback)
 * For invitee: returns invitee_isolated_team_id (or scope_isolated_team_id fallback)
 *
 * This is used by Teams Map/Tree View to show isolated teams.
 */
export async function getVisibleIsolatedTeamIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: connections } = await supabase
    .from('team_connections')
    .select('requester_account_id, receiver_account_id, host_isolated_team_id, invitee_isolated_team_id, scope_isolated_team_id, status')
    .eq('status', 'active')
    .or(`requester_account_id.eq.${userId},receiver_account_id.eq.${userId}`)

  if (!connections) return []

  return connections
    .map(conn => getUserIsolatedTeamId(conn, userId))
    .filter((id): id is string => id !== null)
}
