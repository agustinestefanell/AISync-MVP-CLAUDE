import { createClient } from '@/lib/supabase/server'
import type { TeamWithWorkspaces } from './types'

export async function getActiveProjectId(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  return data?.id ?? null
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
