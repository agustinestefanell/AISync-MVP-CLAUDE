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
  account_name: string | null
  account_email: string | null
  // Contenido real del mensaje reenviado (review_forward Agente↔Agente y
  // Humano→Agente, vía message_provenance — migración 055). NULL cuando el
  // destino es human_chat (sin FK posible, ver migración 055) o cuando el
  // insert de provenance falló en su momento.
  forwarded_content: string | null
}

// review_forward hacia un agente (Agente↔Agente y Humano→Agente) deja una fila
// en message_provenance con source_object_id = audit_log.id. La variante hacia
// human_chat NO la tiene (destino human_messages, sin FK posible — migración 055).
async function getForwardedContent(
  supabase: ReturnType<typeof createClient>,
  eventIds: string[]
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map()
  const { data } = await supabase
    .from('message_provenance')
    .select('source_object_id, messages(content)')
    .eq('source_object_type', 'review_forward')
    .in('source_object_id', eventIds)

  const map = new Map<string, string>()
  for (const row of (data ?? []) as unknown as Array<{ source_object_id: string; messages: { content: string } | null }>) {
    if (row.messages?.content) map.set(row.source_object_id, row.messages.content)
  }
  return map
}

export async function getAuditEvents(): Promise<AuditEventRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, event_type, workspace_id, metadata, created_at, workspaces(name, teams(id, name)), accounts(name, email)')
    .order('created_at', { ascending: false })
    .limit(100)

  // Ver mismo comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
  // handoff-2026-07-c.md OE 2026-09-04.
  if (error) console.error('[getAuditEvents] query failed:', error)

  const rows = (data ?? []) as unknown as Array<{
    id: string
    event_type: string
    workspace_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    workspaces: { name: string; teams: { id: string; name: string } | null } | null
    accounts: { name: string | null; email: string | null } | null
  }>

  const forwardIds = rows.filter(r => r.event_type === 'review_forward').map(r => r.id)
  const contentMap = await getForwardedContent(supabase, forwardIds)

  return rows.map(r => {
    // For events without workspace (e.g. connection_accepted), extract team info from metadata if available
    const teamId = r.workspaces?.teams?.id ?? null
    const teamName = r.workspaces?.teams?.name ?? (r.metadata?.requester_team_name as string | null | undefined) ?? null

    return {
      id:                r.id,
      event_type:        r.event_type,
      workspace_id:      r.workspace_id,
      team_id:           teamId,
      team_name:         teamName,
      metadata:          r.metadata,
      created_at:        r.created_at,
      workspaces:        r.workspaces ? { name: r.workspaces.name } : null,
      account_name:      r.accounts?.name ?? null,
      account_email:     r.accounts?.email ?? null,
      forwarded_content: contentMap.get(r.id) ?? null,
    }
  })
}
