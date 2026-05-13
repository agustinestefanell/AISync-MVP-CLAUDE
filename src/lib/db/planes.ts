/**
 * AISync Architectural Planes — Official Definition
 *
 * CONTROL PLANE (AISync-owned):
 * Identity, structure, metadata, states, traceability, events,
 * relationships, provenance, and operational logic.
 * These objects belong to AISync because they enable it to function
 * as a control layer, operational memory, and governance system.
 *
 * CONTENT PLANE (Client-owned, migratable):
 * Any artifact produced, saved, or contributed by the user during
 * their workflow. These objects must be designed as migratable —
 * not as AISync canonical data.
 *
 * In this phase, content plane objects may physically reside in
 * platform infrastructure, but they are modeled as client property.
 * Future phases will allow residency in client-controlled infrastructure
 * without requiring destructive rewrites.
 */

export const CONTROL_PLANE_TABLES = [
  'accounts',
  'projects',
  'teams',
  'workspaces',
  'agent_sessions',
  'audit_log',
  'system_log',
  'provenance_log',
  'user_api_keys',
  'user_custom_providers',
  'team_connections',
  'admin_events',
  'system_prompts',
] as const

export const CONTENT_PLANE_TABLES = [
  'checkpoints',
  'checkpoint_messages',
  'messages',
] as const

export type ControlPlaneTable = typeof CONTROL_PLANE_TABLES[number]
export type ContentPlaneTable = typeof CONTENT_PLANE_TABLES[number]

/**
 * Returns true if the object belongs to the client content plane
 * and should be treated as migratable client property.
 */
export function isClientContent(table: string): boolean {
  return (CONTENT_PLANE_TABLES as readonly string[]).includes(table)
}
