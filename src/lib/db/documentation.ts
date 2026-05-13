// CONTENT PLANE — These queries operate on client-owned artifacts.
// Data is currently stored in platform infrastructure but must be
// treated as migratable client property. See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'

export interface DocCheckpoint {
  id: string
  name: string
  purpose: string
  doc_state: string
  object_type: string
  sensitivity: string
  version_label: string
  responsible: string | null
  workspace_id: string
  workspace_name: string
  team_id: string
  team_name: string
  team_type: string
  project_id: string
  project_name: string
  created_at: string
}

export interface DocAuditEvent {
  id: string
  event_type: string
  workspace_id: string | null
  workspace_name: string | null
  team_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface RawCheckpoint {
  id: string
  name: string
  purpose: string
  doc_state: string | null
  object_type: string | null
  sensitivity: string | null
  version_label: string | null
  responsible: string | null
  workspace_id: string
  created_at: string
  workspaces: {
    id: string
    name: string
    teams: {
      id: string
      name: string
      type: string
      projects: { id: string; name: string } | null
    } | null
  } | null
}

export async function getDocCheckpoints(): Promise<DocCheckpoint[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('checkpoints')
    .select(`
      id, name, purpose,
      doc_state, object_type, sensitivity, version_label, responsible,
      workspace_id, created_at,
      workspaces (
        id, name,
        teams (
          id, name, type,
          projects (id, name)
        )
      )
    `)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawCheckpoint[]).map(r => ({
    id:             r.id,
    name:           r.name,
    purpose:        r.purpose ?? 'Checkpoint',
    doc_state:      r.doc_state  ?? 'active',
    object_type:    r.object_type ?? 'checkpoint',
    sensitivity:    r.sensitivity ?? 'internal',
    version_label:  r.version_label ?? 'v1',
    responsible:    r.responsible ?? null,
    workspace_id:   r.workspace_id,
    workspace_name: r.workspaces?.name ?? '—',
    team_id:        r.workspaces?.teams?.id ?? '',
    team_name:      r.workspaces?.teams?.name ?? '—',
    team_type:      r.workspaces?.teams?.type ?? 'SAT',
    project_id:     r.workspaces?.teams?.projects?.id ?? '',
    project_name:   r.workspaces?.teams?.projects?.name ?? '—',
    created_at:     r.created_at,
  }))
}

export interface DocHandoffPackage {
  id: string
  name: string
  from_agent: string
  to_agent: string
  status: string
  context: string | null
  workspace_id: string
  workspace_name: string
  message_count: number
  created_at: string
}

interface RawHandoffPackage {
  id: string
  name: string
  from_agent: string
  to_agent: string
  status: string
  context: string | null
  messages: unknown[]
  workspace_id: string
  created_at: string
  workspaces: { name: string } | null
}

export async function getHandoffPackages(): Promise<DocHandoffPackage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('handoff_packages')
    .select('id, name, from_agent, to_agent, status, context, messages, workspace_id, created_at, workspaces(name)')
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawHandoffPackage[]).map(r => ({
    id:             r.id,
    name:           r.name,
    from_agent:     r.from_agent,
    to_agent:       r.to_agent,
    status:         r.status,
    context:        r.context ?? null,
    workspace_id:   r.workspace_id,
    workspace_name: r.workspaces?.name ?? '—',
    message_count:  Array.isArray(r.messages) ? r.messages.length : 0,
    created_at:     r.created_at,
  }))
}

export async function getDocAuditEvents(): Promise<DocAuditEvent[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('audit_log')
    .select(`
      id, event_type, workspace_id, metadata, created_at,
      workspaces (name, teams (name))
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  return ((data ?? []) as unknown as Array<{
    id: string
    event_type: string
    workspace_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    workspaces: { name: string; teams: { name: string } | null } | null
  }>).map(r => ({
    id:             r.id,
    event_type:     r.event_type,
    workspace_id:   r.workspace_id,
    workspace_name: r.workspaces?.name ?? null,
    team_name:      r.workspaces?.teams?.name ?? null,
    metadata:       r.metadata,
    created_at:     r.created_at,
  }))
}
