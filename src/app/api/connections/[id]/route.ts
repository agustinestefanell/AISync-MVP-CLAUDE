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
    .select('id, status, receiver_email, receiver_account_id, requester_account_id, requester_email, requester_team_name, receiver_team_name, description')
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
    // receiver_team_id is now optional — isolated team is created automatically
    const { data, error } = await supabase
      .from('team_connections')
      .update({
        receiver_account_id: user.id,
        receiver_team_id:    body.receiver_team_id ?? null,
        receiver_team_name:  body.receiver_team_name ?? null,
        status:              'active',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // OE C (Pieza 1): Register connection acceptance in BOTH accounts' audit_log
    // Insert for invitee (current user who accepted)
    try {
      await supabase.from('audit_log').insert({
        account_id:   user.id,
        workspace_id: null,
        event_type:   'connection_accepted',
        metadata: {
          connection_id:       params.id,
          requester_email:     data.requester_email,
          requester_team_name: data.requester_team_name,
          description:         data.description,
          viewer_role:         'invitee',
          // OE C (Pieza 2): Fallback message for missing traceability data
          traceability_note:   `Detailed traceability data lives in ${data.requester_email}'s account. This workspace shows only what's shared with you.`,
        },
      })
    } catch (auditError) {
      // Fail-open: audit log failure must not block connection acceptance
      console.error('[accept] Failed to insert audit_log event for invitee:', auditError)
    }

    // Insert for requester (host who initiated the connection)
    if (data.requester_account_id) {
      try {
        await createAdminClient().from('audit_log').insert({
          account_id:   data.requester_account_id,
          workspace_id: null,
          event_type:   'connection_accepted',
          metadata: {
            connection_id:       params.id,
            receiver_email:      data.receiver_email ?? user.email,
            receiver_team_name:  data.receiver_team_name,
            description:         data.description,
            viewer_role:         'host',
            traceability_note:   `Connection accepted by ${data.receiver_email ?? user.email}. Shared workspace is now active.`,
          },
        })
      } catch (auditError) {
        console.error('[accept] Failed to insert audit_log event for requester:', auditError)
      }
    }

    // OE A: Create Scope Isolated Team (fail-open — accept must succeed even if this fails)
    try {
      // Check if isolated team already exists (prevent duplicates on retry)
      if (!data.scope_isolated_team_id) {
        // Fetch full connection data to get requester info
        const { data: fullConnection } = await createAdminClient()
          .from('team_connections')
          .select('requester_account_id, requester_team_id, requester_team_name, receiver_email, description, color')
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
                description: fullConnection.description ?? `Shared workspace with ${fullConnection.receiver_email}`,
                color: fullConnection.color ?? '#000000',
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

                // Link isolated team and workspace to connection (uses admin client)
                await createAdminClient()
                  .from('team_connections')
                  .update({
                    scope_isolated_team_id: isolatedTeam.id,
                    scope_isolated_workspace_id: isolatedWorkspace.id,
                  })
                  .eq('id', params.id)

                // Etapa 2: Create two separate projects and teams (host + invitee)
                // Create project for Host
                const { data: hostProject } = await createAdminClient()
                  .from('projects')
                  .insert({
                    account_id: fullConnection.requester_account_id,
                    name: `${data.requester_email}+${data.receiver_email ?? user.email}`,
                    status: 'active',
                  })
                  .select()
                  .single()

                // Create project for Invitee
                const { data: inviteeProject } = await createAdminClient()
                  .from('projects')
                  .insert({
                    account_id: user.id,
                    name: `${data.receiver_email ?? user.email}+${data.requester_email}`,
                    status: 'active',
                  })
                  .select()
                  .single()

                if (hostProject && inviteeProject) {
                  // Move Host's isolated team to Host's new project
                  await createAdminClient()
                    .from('teams')
                    .update({ project_id: hostProject.id })
                    .eq('id', isolatedTeam.id)

                  // Create Invitee's isolated team in Invitee's new project
                  const inviteeTeamName = `Shared: ${data.receiver_email ?? user.email} ↔ ${data.requester_email}`
                  const { data: inviteeTeam } = await createAdminClient()
                    .from('teams')
                    .insert({
                      project_id: inviteeProject.id,
                      name: inviteeTeamName,
                      type: 'isolated',
                      parent_id: null,
                      description: fullConnection.description ?? `Shared workspace with ${data.requester_email}`,
                      color: fullConnection.color ?? '#000000',
                    })
                    .select()
                    .single()

                  if (inviteeTeam) {
                    // Create workspace for Invitee
                    const { data: inviteeWorkspace } = await createAdminClient()
                      .from('workspaces')
                      .insert({
                        team_id: inviteeTeam.id,
                        name: `Workspace ${inviteeTeamName}`,
                      })
                      .select()
                      .single()

                    if (inviteeWorkspace) {
                      // Create 3 agent_sessions for Invitee (same provider/model as Host)
                      await createAdminClient().from('agent_sessions').insert([
                        {
                          workspace_id: inviteeWorkspace.id,
                          agent_role: 'manager',
                          provider: defaultProvider,
                          model: defaultModel,
                        },
                        {
                          workspace_id: inviteeWorkspace.id,
                          agent_role: 'worker1',
                          provider: defaultProvider,
                          model: defaultModel,
                        },
                        {
                          workspace_id: inviteeWorkspace.id,
                          agent_role: 'worker2',
                          provider: defaultProvider,
                          model: defaultModel,
                        },
                      ])

                      // Update team_connections with both isolated team IDs (Etapa 2)
                      await createAdminClient()
                        .from('team_connections')
                        .update({
                          host_isolated_team_id: isolatedTeam.id,
                          invitee_isolated_team_id: inviteeTeam.id,
                        })
                        .eq('id', params.id)
                    }
                  }
                }
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

    // Register disconnection in audit_log for BOTH parties
    const isRequester = connection.requester_account_id === user.id
    const disconnectedBy = isRequester ? 'requester' : 'receiver'
    const viewerRole = isRequester ? 'host' : 'invitee'

    // Insert for current user (who initiated disconnect)
    try {
      await supabase.from('audit_log').insert({
        account_id:   user.id,
        workspace_id: null,
        event_type:   'connection_disconnected',
        metadata: {
          connection_id:       params.id,
          partner_email:       isRequester ? connection.receiver_email : connection.requester_email,
          partner_team_name:   isRequester ? (connection.receiver_team_name ?? null) : connection.requester_team_name,
          description:         connection.description,
          disconnected_by:     disconnectedBy,
          viewer_role:         viewerRole,
          traceability_note:   `Connection disconnected by ${disconnectedBy}. Detailed traceability data lives in ${isRequester ? connection.receiver_email : connection.requester_email}'s account.`,
        },
      })
    } catch (auditError) {
      console.error('[disconnect] Failed to insert audit_log event for initiator:', auditError)
    }

    // Insert for the other party (passive receiver of disconnect)
    const otherAccountId = isRequester ? connection.receiver_account_id : connection.requester_account_id
    const otherViewerRole = isRequester ? 'invitee' : 'host'
    if (otherAccountId) {
      try {
        await createAdminClient().from('audit_log').insert({
          account_id:   otherAccountId,
          workspace_id: null,
          event_type:   'connection_disconnected',
          metadata: {
            connection_id:       params.id,
            partner_email:       isRequester ? connection.requester_email : connection.receiver_email,
            partner_team_name:   isRequester ? connection.requester_team_name : (connection.receiver_team_name ?? null),
            description:         connection.description,
            disconnected_by:     disconnectedBy,
            viewer_role:         otherViewerRole,
            traceability_note:   `Connection disconnected by ${disconnectedBy}. You were notified of this action.`,
          },
        })
      } catch (auditError) {
        console.error('[disconnect] Failed to insert audit_log event for other party:', auditError)
      }
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
    .select('id, requester_account_id, receiver_email, requester_team_name, description')
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

  // Register cancellation in audit_log (only for requester, receiver never accepted)
  try {
    await supabase.from('audit_log').insert({
      account_id:   user.id,
      workspace_id: null,
      event_type:   'connection_cancelled',
      metadata: {
        connection_id:       params.id,
        receiver_email:      toDelete.receiver_email,
        requester_team_name: toDelete.requester_team_name,
        description:         toDelete.description,
        viewer_role:         'host',
        traceability_note:   'Pending connection request cancelled before acceptance.',
      },
    })
  } catch (auditError) {
    console.error('[delete] Failed to insert audit_log event:', auditError)
  }

  return NextResponse.json({ ok: true })
}
