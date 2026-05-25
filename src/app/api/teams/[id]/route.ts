import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function computeType(agents: Array<{ provider: string }>): 'SAT' | 'MAT' {
  const providers = new Set(agents.map(a => a.provider))
  return providers.size === 1 ? 'SAT' : 'MAT'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, parentId, agents, description, lead_role } = body as {
    name: string
    parentId: string | null
    description?: string | null
    lead_role?: 'manager' | 'submanager' | 'worker'
    agents: Array<{ id: string; provider: string; model: string; config?: Record<string, unknown> | null; description?: string | null }>
  }

  const teamType = computeType(agents)

  const { error: teamErr } = await supabase
    .from('teams')
    .update({
      name:        name.trim(),
      parent_id:   parentId ?? null,
      type:        teamType,
      description: description ?? null,
      lead_role:   lead_role ?? 'worker',
    })
    .eq('id', params.id)
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 })

  for (const agent of agents) {
    await supabase
      .from('agent_sessions')
      .update({
        provider:    agent.provider,
        model:       agent.model,
        config:      agent.config ?? null,
        description: agent.description ?? null,
      })
      .eq('id', agent.id)
  }

  const { data: full, error: fullErr } = await supabase
    .from('teams')
    .select('*, workspaces(*, agent_sessions(*))')
    .eq('id', params.id)
    .single()

  if (fullErr || !full) return NextResponse.json({ error: 'Could not reload updated team.' }, { status: 500 })

  return NextResponse.json(full)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('teams').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
