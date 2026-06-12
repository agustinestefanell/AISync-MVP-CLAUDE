import { createClient } from '@/lib/supabase/server'
import type { TeamWithWorkspaces } from './types'

// Fuente única del proyecto activo (ARC-004). Lee accounts.active_project_id
// (migración 027) validando ownership y status; cae al primer proyecto activo
// si la selección es null, fue borrada o quedó inactiva. Antes de aplicar la
// 027, el select de accounts falla silenciosamente y opera solo el fallback.
export async function getActiveProjectId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: account } = await supabase
    .from('accounts')
    .select('active_project_id')
    .eq('id', user.id)
    .single()

  if (account?.active_project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', account.active_project_id)
      .eq('account_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (project?.id) return project.id
  }

  const { data: first } = await supabase
    .from('projects')
    .select('id')
    .eq('account_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return first?.id ?? null
}

export async function getTeamsForProject(projectId: string): Promise<TeamWithWorkspaces[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('teams')
    .select('*, workspaces(*, agent_sessions(*))')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  return (data as unknown as TeamWithWorkspaces[]) ?? []
}
