import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'accept' | 'reject' | 'disconnect'
    receiver_team_id?: string
    receiver_team_name?: string
  }

  // SEC-010: una sola lectura, autorización por acción — accept/reject opera solo
  // sobre pendientes (receiver), disconnect solo sobre activas (cualquier punta)
  const { data: connection } = await supabase
    .from('team_connections')
    .select('id, status, receiver_email, receiver_account_id, requester_account_id')
    .eq('id', params.id)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
  }

  // receiver_account_id se setea recién al aceptar — para pendientes vale el email
  const isReceiver =
    connection.receiver_account_id === user.id ||
    connection.receiver_email?.toLowerCase() === user.email?.toLowerCase()

  if (body.action === 'accept' || body.action === 'reject') {
    // Gap 3: solo el receiver legítimo, solo sobre solicitudes pendientes
    if (connection.status !== 'pending') {
      return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
    }
    if (!isReceiver) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }
  }

  if (body.action === 'accept') {
    if (!body.receiver_team_id || !body.receiver_team_name) {
      return NextResponse.json({ error: 'Please select a team to accept the connection.' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('team_connections')
      .update({
        receiver_account_id: user.id,
        receiver_team_id:    body.receiver_team_id,
        receiver_team_name:  body.receiver_team_name,
        status:              'active',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // OE A: Create Scope Isolated Team (fail-open — accept must succeed even if this fails)
    try {
      // Check if isolated team already exists (prevent duplicates on retry)
      if (!data.scope_isolated_team_id) {
        // Fetch full connection data to get requester info
        const { data: fullConnection } = await createAdminClient()
          .from('team_connections')
          .select('requester_account_id, requester_team_id, requester_team_name, receiver_email')
          .eq('id', params.id)
          .single()

        if (fullConnection) {
          // Fetch requester team to get project_id and default provider/model (uses admin client to read requester's data)
          const { data: requesterTeam } = await createAdminClient()
            .from('teams')
            .select('project_id, workspaces(agent_sessions(provider, model))')
            .eq('id', fullConnection.requester_team_id)
            .single()

          if (requesterTeam) {
            // Get provider/model from requester team's first agent_session
            const firstSession = requesterTeam.workspaces?.[0]?.agent_sessions?.[0]
            const defaultProvider = firstSession?.provider || 'Anthropic'
            const defaultModel = firstSession?.model || 'Claude 3.5 Sonnet'

            // Create isolated team (uses admin client to bypass RLS — team belongs to requester's project)
            const isolatedTeamName = `Shared: ${fullConnection.requester_team_name} ↔ ${fullConnection.receiver_email}`
            const { data: isolatedTeam } = await createAdminClient()
              .from('teams')
              .insert({
                project_id: requesterTeam.project_id,
                name: isolatedTeamName,
                type: 'isolated',
                parent_id: null,
                description: `Shared workspace with ${fullConnection.receiver_email}`,
              })
              .select()
              .single()

            if (isolatedTeam) {
              // Create workspace (uses admin client)
              const { data: isolatedWorkspace } = await createAdminClient()
                .from('workspaces')
                .insert({
                  team_id: isolatedTeam.id,
                  name: `Workspace ${isolatedTeamName}`,
                })
                .select()
                .single()

              if (isolatedWorkspace) {
                // Create 3 agent_sessions (manager, worker1, worker2) (uses admin client)
                await createAdminClient().from('agent_sessions').insert([
                  {
                    workspace_id: isolatedWorkspace.id,
                    agent_role: 'manager',
                    provider: defaultProvider,
                    model: defaultModel,
                  },
                  {
                    workspace_id: isolatedWorkspace.id,
                    agent_role: 'worker1',
                    provider: defaultProvider,
                    model: defaultModel,
                  },
                  {
                    workspace_id: isolatedWorkspace.id,
                    agent_role: 'worker2',
                    provider: defaultProvider,
                    model: defaultModel,
                  },
                ])

                // Link isolated team to connection (uses admin client)
                await createAdminClient()
                  .from('team_connections')
                  .update({ scope_isolated_team_id: isolatedTeam.id })
                  .eq('id', params.id)
              }
            }
          }
        }
      }
    } catch (isolatedTeamError) {
      // Fail-open: log error but don't block accept
      console.error('[accept] Failed to create Scope Isolated Team:', isolatedTeamError)
    }

    return NextResponse.json({ ...data, direction: 'incoming' })
  }

  if (body.action === 'reject') {
    const { error } = await supabase
      .from('team_connections')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'disconnect') {
    if (connection.status !== 'active') {
      return NextResponse.json({ error: 'Connection is not active.' }, { status: 400 })
    }
    if (connection.requester_account_id !== user.id && !isReceiver) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    const { data: updated, error } = await supabase
      .from('team_connections')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('status', 'active')
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Disconnect did not persist.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Solo el solicitante puede cancelar, y solo si está pendiente
  const { data: toDelete } = await supabase
    .from('team_connections')
    .select('id, requester_account_id')
    .eq('id', params.id)
    .single()

  if (!toDelete) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
  }

  if (toDelete.requester_account_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('team_connections')
    .delete()
    .eq('id', params.id)
    .eq('requester_account_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
