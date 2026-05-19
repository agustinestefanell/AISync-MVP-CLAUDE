import { createClient } from '@/lib/supabase/server'
import type { WorkspaceWithAgents } from './types'

export async function getWorkspaceWithAgents(workspaceId: string): Promise<WorkspaceWithAgents | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('workspaces')
    .select('*, agent_sessions(*), teams(id, name, parent_id, project_id, created_at)')
    .eq('id', workspaceId)
    .single()
  return (data as WorkspaceWithAgents) ?? null
}
