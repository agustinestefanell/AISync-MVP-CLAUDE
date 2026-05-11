// CONTROL PLANE — Admin metrics. Server-side only via service_role.
import { createAdminClient } from '@/lib/supabase/admin'

export interface UserMetrics {
  total:        number
  new7d:        number
  new30d:       number
  byRole:       Record<string, number>
  byStatus:     Record<string, number>
}

export interface UsageMetrics {
  totalCheckpoints: number
  totalAuditEvents: number
  topByCheckpoints: { email: string; count: number }[]
  topByEvents:      { email: string; count: number }[]
  topProviders:     { provider: string; count: number }[]
}

export interface SystemMetrics {
  totalProjects:  number
  totalTeams:     number
  totalWorkspaces: number
  totalAgentSessions: number
}

export interface AccountRow {
  id:         string
  email:      string
  name:       string | null
  role:       string
  status:     string
  created_at: string
}

export interface SystemPromptRow {
  id:          string
  role:        string
  display_name: string
  base_layer:  string
  role_prompt: string
  is_active:   boolean
  updated_at:  string
}

export async function getUserMetrics(): Promise<UserMetrics> {
  const supabase = createAdminClient()
  const now = new Date()
  const d7  = new Date(now.getTime() - 7  * 24 * 3600 * 1000).toISOString()
  const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('role, status, created_at')

  const rows = (accounts ?? []) as { role: string; status: string; created_at: string }[]

  const byRole:   Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  let new7d = 0, new30d = 0

  for (const r of rows) {
    byRole[r.role]     = (byRole[r.role]     ?? 0) + 1
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    if (r.created_at >= d7)  new7d++
    if (r.created_at >= d30) new30d++
  }

  return { total: rows.length, new7d, new30d, byRole, byStatus }
}

export async function getUsageMetrics(): Promise<UsageMetrics> {
  const supabase = createAdminClient()

  const [
    { count: totalCheckpoints },
    { count: totalAuditEvents },
    { data: apiKeys },
  ] = await Promise.all([
    supabase.from('checkpoints').select('*', { count: 'exact', head: true }),
    supabase.from('audit_log').select('*', { count: 'exact', head: true }),
    supabase.from('user_api_keys').select('provider'),
  ])

  const providerMap: Record<string, number> = {}
  for (const k of (apiKeys ?? []) as { provider: string }[]) {
    providerMap[k.provider] = (providerMap[k.provider] ?? 0) + 1
  }
  const topProviders = Object.entries(providerMap)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalCheckpoints:  totalCheckpoints ?? 0,
    totalAuditEvents:  totalAuditEvents ?? 0,
    topByCheckpoints:  [],
    topByEvents:       [],
    topProviders,
  }
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const supabase = createAdminClient()

  const [
    { count: totalProjects },
    { count: totalTeams },
    { count: totalWorkspaces },
    { count: totalAgentSessions },
  ] = await Promise.all([
    supabase.from('projects').select('*',       { count: 'exact', head: true }),
    supabase.from('teams').select('*',           { count: 'exact', head: true }),
    supabase.from('workspaces').select('*',      { count: 'exact', head: true }),
    supabase.from('agent_sessions').select('*',  { count: 'exact', head: true }),
  ])

  return {
    totalProjects:      totalProjects      ?? 0,
    totalTeams:         totalTeams         ?? 0,
    totalWorkspaces:    totalWorkspaces    ?? 0,
    totalAgentSessions: totalAgentSessions ?? 0,
  }
}

export async function getAllAccounts(): Promise<AccountRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('accounts')
    .select('id, email, name, role, status, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []) as AccountRow[]
}

export async function getSystemPrompts(): Promise<SystemPromptRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('system_prompts')
    .select('id, role, display_name, base_layer, role_prompt, is_active, updated_at')
    .order('role')
  return (data ?? []) as SystemPromptRow[]
}

export async function getAdminEvents(limit = 50) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('admin_events')
    .select('id, admin_user_id, action, target_user_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
