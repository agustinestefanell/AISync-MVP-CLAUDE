// CONTROL PLANE — AISync operational traceability.
// This data belongs to the platform, not to client content.

import { createClient } from '@/lib/supabase/server'

export interface AuditEventRow {
  id: string
  event_type: string
  workspace_id: string | null
  team_id: string | null
  team_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  workspaces: { name: string } | null
}

export async function getAuditEvents(): Promise<AuditEventRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, event_type, workspace_id, metadata, created_at, workspaces(name, teams(id, name))')
    .order('created_at', { ascending: false })
    .limit(100)

  return ((data ?? []) as unknown as Array<{
    id: string
    event_type: string
    workspace_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    workspaces: { name: string; teams: { id: string; name: string } | null } | null
  }>).map(r => ({
    id:           r.id,
    event_type:   r.event_type,
    workspace_id: r.workspace_id,
    team_id:      r.workspaces?.teams?.id   ?? null,
    team_name:    r.workspaces?.teams?.name ?? null,
    metadata:     r.metadata,
    created_at:   r.created_at,
    workspaces:   r.workspaces ? { name: r.workspaces.name } : null,
  }))
}
