import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function computeType(agents: Array<{ provider: string }>): 'SAT' | 'MAT' {
  const providers = new Set(agents.map(a => a.provider))
  return providers.size === 1 ? 'SAT' : 'MAT'
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('teams')
    .select('*, workspaces(*, agent_sessions(*))')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, projectId, parentId, agents } = body as {
    name: string
    projectId: string
    parentId: string | null
    agents: Array<{ role: string; provider: string; model: string; config?: Record<string, unknown> }>
  }

  if (!name?.trim() || !projectId || !agents?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const teamType = computeType(agents)

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ project_id: projectId, name: name.trim(), type: teamType, parent_id: parentId ?? null })
    .select()
    .single()
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 })

  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .insert({ team_id: team.id, name: `Workspace ${name.trim()}` })
    .select()
    .single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })

  const { error: agentsErr } = await supabase.from('agent_sessions').insert(
    agents.map(a => ({
      workspace_id: workspace.id,
      agent_role:   a.role,
      provider:     a.provider,
      model:        a.model,
      config:       a.config ?? null,
    }))
  )
  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })

  const { data: full } = await supabase
    .from('teams')
    .select('*, workspaces(*, agent_sessions(*))')
    .eq('id', team.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
