import { createClient } from '@/lib/supabase/server'

export interface PromptRow {
  id:         string
  user_id:    string
  title:      string
  body:       string
  scope:      'worker' | 'team' | null
  status:     string
  version:    number
  tags:       string[] | null
  notes:      string | null
  created_at: string
  updated_at: string
}

export async function listActivePromptsForContext(params: {
  teamId:     string | null | undefined
  sessionId:  string | null | undefined
  agentRole:  string | null | undefined
}): Promise<{ teamPrompts: PromptRow[]; workerPrompts: PromptRow[] }> {
  const supabase    = createClient()
  const teamPrompts:   PromptRow[] = []
  const workerPrompts: PromptRow[] = []

  if (params.teamId) {
    try {
      const { data: assignments } = await supabase
        .from('prompt_assignments')
        .select('prompt_id')
        .eq('assigned_to', 'team')
        .eq('target_id', params.teamId)
        .eq('is_active', true)

      if (assignments && assignments.length > 0) {
        const ids = assignments.map(a => a.prompt_id)
        const { data: prompts } = await supabase
          .from('prompt_library')
          .select('*')
          .in('id', ids)
          .eq('status', 'active')
        if (prompts) teamPrompts.push(...(prompts as PromptRow[]))
      }
    } catch { /* team prompts unavailable — continue */ }
  }

  if (params.sessionId) {
    try {
      let q = supabase
        .from('prompt_assignments')
        .select('prompt_id')
        .eq('assigned_to', 'worker')
        .eq('target_id', params.sessionId)
        .eq('is_active', true)
      if (params.agentRole) q = q.eq('agent_role', params.agentRole)

      const { data: assignments } = await q

      if (assignments && assignments.length > 0) {
        const ids = assignments.map(a => a.prompt_id)
        const { data: prompts } = await supabase
          .from('prompt_library')
          .select('*')
          .in('id', ids)
          .eq('status', 'active')
        if (prompts) workerPrompts.push(...(prompts as PromptRow[]))
      }
    } catch { /* worker prompts unavailable — continue */ }
  }

  return { teamPrompts, workerPrompts }
}
