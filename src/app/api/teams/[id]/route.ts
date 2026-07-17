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

  // Handle archive action separately
  if (body.action === 'archive') {
    const { archive_reason } = body as { action: 'archive'; archive_reason?: string }

    const { data: updatedData, error: archiveErr } = await supabase
      .from('teams')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: user.id,
        archive_reason: archive_reason?.trim() || null,
      })
      .eq('id', params.id)
      .select()

    if (archiveErr) {
      console.error('[PATCH /api/teams/[id]] Archive failed - Supabase error', {
        teamId: params.id,
        userId: user.id,
        error: archiveErr
      })
      return NextResponse.json({ error: archiveErr.message }, { status: 500 })
    }

    if (!updatedData || updatedData.length === 0) {
      console.error('[PATCH /api/teams/[id]] Archive blocked - no rows affected', {
        teamId: params.id,
        userId: user.id,
        possibleCause: 'RLS policy blocked update, team not found, or team does not belong to user\'s projects'
      })
      return NextResponse.json({
        error: 'Failed to archive team. You may not have permission to modify this team, or the team was not found.'
      }, { status: 403 })
    }

    // Register team_archived event in audit_log (fail-open)
    try {
      await supabase.from('audit_log').insert({
        account_id: user.id,
        workspace_id: null,
        event_type: 'team_archived',
        metadata: {
          team_id: params.id,
          team_name: updatedData[0].name,
          project_id: updatedData[0].project_id,
          team_type: updatedData[0].type,
          archived_by: user.id,
          archive_reason: archive_reason?.trim() || null,
        },
      })
    } catch (auditError) {
      console.error('[archive] Failed to insert team_archived audit event:', auditError)
    }

    const { data: full, error: fullErr } = await supabase
      .from('teams')
      .select('*, workspaces(*, agent_sessions(*))')
      .eq('id', params.id)
      .single()

    if (fullErr || !full) {
      return NextResponse.json({ error: 'Could not reload archived team.' }, { status: 500 })
    }

    return NextResponse.json(full)
  }

  // Normal team update (name, description, agents, etc.)
  const { name, parentId, agents, description, lead_role } = body as {
    name: string
    parentId: string | null
    description?: string | null
    lead_role?: 'manager' | 'submanager' | 'worker'
    agents: Array<{ id: string; provider: string; model: string; config?: Record<string, unknown> | null; description?: string | null }>
  }

  // Read current team type to preserve 'isolated' teams (Connected Teams)
  const { data: currentTeam, error: readErr } = await supabase
    .from('teams')
    .select('type')
    .eq('id', params.id)
    .single()

  if (readErr || !currentTeam) {
    return NextResponse.json({ error: 'Team not found or could not be read.' }, { status: 404 })
  }

  // Preserve 'isolated' type for Connected Teams; recalculate SAT/MAT for normal teams
  const teamType = currentTeam.type === 'isolated' ? 'isolated' : computeType(agents)

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
