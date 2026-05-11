import { createClient } from '@/lib/supabase/server'
import type { ProjectWithTeams } from './types'

export async function getProjectsWithHierarchy(): Promise<ProjectWithTeams[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('projects')
    .select(`
      *,
      teams (
        *,
        workspaces (
          *,
          agent_sessions (*)
        )
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  return (data as ProjectWithTeams[]) ?? []
}

export async function createProject(accountId: string, name: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({ account_id: accountId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createDemoProject(accountId: string) {
  const supabase = createClient()

  // Guard idempotente: no crear si ya tiene proyectos
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
  if ((count ?? 0) > 0) return

  const { data: project } = await supabase
    .from('projects')
    .insert({ account_id: accountId, name: 'Mi Primer Proyecto' })
    .select()
    .single()
  if (!project) return

  const { data: team } = await supabase
    .from('teams')
    .insert({ project_id: project.id, name: 'Equipo Principal', type: 'SAT' })
    .select()
    .single()
  if (!team) return

  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({ team_id: team.id, name: 'Workspace Principal' })
    .select()
    .single()
  if (!workspace) return

  await supabase.from('agent_sessions').insert([
    { workspace_id: workspace.id, agent_role: 'manager', provider: 'Google',    model: 'Gemini 2.0' },
    { workspace_id: workspace.id, agent_role: 'worker1', provider: 'Anthropic', model: 'Claude 3.5 Sonnet' },
    { workspace_id: workspace.id, agent_role: 'worker2', provider: 'OpenAI',    model: 'GPT-4o' },
  ])
}
