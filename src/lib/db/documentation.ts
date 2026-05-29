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
  project_id:       string
  project_name:     string
  created_at:       string
  content_preview?: string
}

export interface DocAuditEvent {
  id: string
  event_type: string
  workspace_id: string | null
  workspace_name: string | null
  team_id: string | null
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
  checkpoint_messages: { content: string; role: string; position: number }[] | null
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
      checkpoint_messages(content, role, position),
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
    project_id:      r.workspaces?.teams?.projects?.id ?? '',
    project_name:    r.workspaces?.teams?.projects?.name ?? '—',
    created_at:      r.created_at,
    content_preview: (() => {
      const msgs = Array.isArray(r.checkpoint_messages) ? r.checkpoint_messages : []
      const assistantMsgs = msgs.filter(m => m.role === 'assistant')
      const sorted = [...assistantMsgs].sort((a, b) => a.position - b.position)
      const last = sorted[sorted.length - 1]
      if (!last) return undefined
      const content = last.content ?? ''
      return content.length > 0
        ? content.slice(0, 600) + (content.length > 600 ? '…' : '')
        : undefined
    })(),
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
  team_id: string | null
  team_name: string | null
  project_id: string | null
  project_name: string | null
  message_count:   number
  content_preview?: string
  created_at:      string
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
  workspaces: {
    name: string
    teams: { id: string; name: string; projects: { id: string; name: string } | null } | null
  } | null
}

export async function getHandoffPackages(): Promise<DocHandoffPackage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('handoff_packages')
    .select('id, name, from_agent, to_agent, status, context, messages, workspace_id, created_at, workspaces(name, teams(id, name, projects(id, name)))')
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawHandoffPackage[]).map(r => {
    const team    = Array.isArray(r.workspaces?.teams) ? r.workspaces?.teams[0] : r.workspaces?.teams
    const project = Array.isArray(team?.projects)      ? team?.projects[0]      : team?.projects
    return {
      id:             r.id,
      name:           r.name,
      from_agent:     r.from_agent,
      to_agent:       r.to_agent,
      status:         r.status,
      context:        r.context ?? null,
      workspace_id:   r.workspace_id,
      workspace_name: r.workspaces?.name ?? '—',
      team_id:        team?.id        ?? null,
      team_name:      team?.name      ?? null,
      project_id:     project?.id     ?? null,
      project_name:   project?.name   ?? null,
      message_count:   Array.isArray(r.messages) ? r.messages.length : 0,
      content_preview: (() => {
        const msgs = Array.isArray(r.messages) ? r.messages : []
        const last = msgs[msgs.length - 1] as Record<string, unknown> | undefined
        if (!last) return undefined
        const content = last.content ?? last.text ?? last.message ?? ''
        return typeof content === 'string' && content.length > 0
          ? content.slice(0, 600) + (content.length > 600 ? '…' : '')
          : undefined
      })(),
      created_at:      r.created_at,
    }
  })
}

export interface DocSavedSelection {
  id:             string
  name:           string
  messages:       unknown[]
  workspace_id:   string
  workspace_name: string
  team_id:        string | null
  team_name:      string | null
  project_id:     string | null
  project_name:   string | null
  created_at:     string
  user_id:        string
}

interface RawSavedSelection {
  id:           string
  name:         string
  messages:     unknown[]
  workspace_id: string
  team_id:      string | null
  project_id:   string | null
  created_at:   string
  user_id:      string
  workspaces: {
    name: string
    teams: { id: string; name: string; projects: { id: string; name: string } | null } | null
  } | null
}

export async function getSavedSelections(userId: string): Promise<DocSavedSelection[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('saved_selections')
    .select('id, name, messages, workspace_id, team_id, project_id, created_at, user_id, workspaces(name, teams(id, name, projects(id, name)))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as RawSavedSelection[]).map(r => {
    const team    = Array.isArray(r.workspaces?.teams) ? r.workspaces?.teams[0] : r.workspaces?.teams
    const project = Array.isArray(team?.projects)      ? team?.projects[0]      : team?.projects
    return {
      id:             r.id,
      name:           r.name,
      messages:       Array.isArray(r.messages) ? r.messages : [],
      workspace_id:   r.workspace_id,
      workspace_name: r.workspaces?.name ?? '—',
      team_id:        r.team_id ?? null,
      team_name:      team?.name ?? null,
      project_id:     r.project_id ?? null,
      project_name:   project?.name ?? null,
      created_at:     r.created_at,
      user_id:        r.user_id,
    }
  })
}

export async function getDocAuditEvents(): Promise<DocAuditEvent[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('audit_log')
    .select(`
      id, event_type, workspace_id, metadata, created_at,
      workspaces (name, teams (id, name))
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  return ((data ?? []) as unknown as Array<{
    id: string
    event_type: string
    workspace_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    workspaces: { name: string; teams: { id: string; name: string } | null } | null
  }>).map(r => ({
    id:             r.id,
    event_type:     r.event_type,
    workspace_id:   r.workspace_id,
    workspace_name: r.workspaces?.name ?? null,
    team_id:        r.workspaces?.teams?.id ?? null,
    team_name:      r.workspaces?.teams?.name ?? null,
    metadata:       r.metadata,
    created_at:     r.created_at,
  }))
}
