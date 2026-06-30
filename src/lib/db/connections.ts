/**
 * Helpers for team_connections with two-building architecture
 * Part of Connected Teams correction plan (see DECISIONS.md 2026-06-26)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gets the isolated team ID for the host (requester) side of a connection.
 */
export function getHostIsolatedTeamId(connection: {
  host_isolated_team_id?: string | null
}): string | null {
  return connection.host_isolated_team_id ?? null
}

/**
 * Gets the isolated team ID for the invitee (receiver) side of a connection.
 */
export function getInviteeIsolatedTeamId(connection: {
  invitee_isolated_team_id?: string | null
}): string | null {
  return connection.invitee_isolated_team_id ?? null
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
  },
  currentUserId: string
): string | null {
  const isHost = connection.requester_account_id === currentUserId

  if (isHost) {
    return connection.host_isolated_team?.workspaces?.[0]?.id ?? null
  } else {
    return connection.invitee_isolated_team?.workspaces?.[0]?.id ?? null
  }
}

/**
 * Extended select string for team_connections that includes isolated team joins.
 */
export const CONNECTIONS_SELECT_WITH_ISOLATED_TEAMS = '*, description, color, host_isolated_team:host_isolated_team_id(workspaces(id)), invitee_isolated_team:invitee_isolated_team_id(workspaces(id))'

/**
 * Gets isolated team IDs visible to the current user from connections.
 *
 * For host: returns host_isolated_team_id
 * For invitee: returns invitee_isolated_team_id
 *
 * This is used by Teams Map/Tree View to show isolated teams.
 */
export async function getVisibleIsolatedTeamIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: connections } = await supabase
    .from('team_connections')
    .select('requester_account_id, receiver_account_id, host_isolated_team_id, invitee_isolated_team_id, status')
    .eq('status', 'active')
    .or(`requester_account_id.eq.${userId},receiver_account_id.eq.${userId}`)

  if (!connections) return []

  return connections
    .map(conn => getUserIsolatedTeamId(conn, userId))
    .filter((id): id is string => id !== null)
}
