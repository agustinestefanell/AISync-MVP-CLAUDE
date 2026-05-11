// CONTROL PLANE — AISync operational traceability.
// This data belongs to the platform, not to client content.

import { createClient } from '@/lib/supabase/server'

export interface AuditEventRow {
  id: string
  event_type: string
  workspace_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  workspaces: { name: string } | null
}

export async function getAuditEvents(): Promise<AuditEventRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, event_type, workspace_id, metadata, created_at, workspaces(name)')
    .order('created_at', { ascending: false })
    .limit(100)
  return (data as unknown as AuditEventRow[]) ?? []
}
