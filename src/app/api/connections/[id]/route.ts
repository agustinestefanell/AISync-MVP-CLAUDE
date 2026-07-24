import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT } from '@/lib/constants/connectionLimits'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'accept' | 'reject' | 'disconnect'
    receiver_team_id?: string
    receiver_team_name?: string
    receiver_project_id?: string
  }

  // SEC-010: una sola lectura, autorización por acción — accept/reject opera solo
  // sobre pendientes (receiver), disconnect solo sobre activas (cualquier punta)
  const { data: connection } = await supabase
    .from('team_connections')
    .select('id, status, receiver_email, receiver_account_id, requester_account_id, requester_email, requester_team_name, receiver_team_name, description, requester_project_id, requester_team_id, host_isolated_team_id, invitee_isolated_team_id')
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
    // Rule 2: Check total active connections count for this account (invitee)
    const { count: myActiveConnectionsCount } = await supabase
      .from('team_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`requester_account_id.eq.${user.id},receiver_account_id.eq.${user.id}`)

    if (myActiveConnectionsCount !== null && myActiveConnectionsCount >= MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT) {
      return NextResponse.json(
        {
          error: 'Connection limit reached',
          message: `You have reached the maximum of ${MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT} active connections for your current plan. Please upgrade your plan or disconnect an existing connection before accepting new requests.`,
          limit: MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT,
          current: myActiveConnectionsCount,
        },
        { status: 403 }
      )
    }

    // Rule 1: Check for existing active connection between this pair of accounts
    // (This should not happen in practice since the requester already checks this,
    // but we validate again for defense in depth)
    const requesterAccountId = connection.requester_account_id

    const { data: existingPairConnection } = await supabase
      .from('team_connections')
      .select('id')
      .eq('status', 'active')
      .or(`and(requester_account_id.eq.${user.id},receiver_account_id.eq.${requesterAccountId}),and(requester_account_id.eq.${requesterAccountId},receiver_account_id.eq.${user.id})`)
      .maybeSingle()

    if (existingPairConnection) {
      return NextResponse.json(
        {
          error: 'existing_connection',
          message: 'An active connection already exists between these accounts. Cannot accept this request.',
        },
        { status: 409 }
      )
    }

    // Validate receiver_project_id if provided
    if (body.receiver_project_id) {
      const { data: receiverProject } = await supabase
        .from('projects')
        .select('id')
        .eq('id', body.receiver_project_id)
        .eq('account_id', user.id)
        .single()

      if (!receiverProject) {
        return NextResponse.json(
          { error: 'Invalid project. You do not own this project.' },
          { status: 403 }
        )
      }
    }

    // receiver_team_id is now optional — isolated team is created automatically
    const { data, error } = await supabase
      .from('team_connections')
      .update({
        receiver_account_id: user.id,
        receiver_team_id:    body.receiver_team_id ?? null,
        receiver_team_name:  body.receiver_team_name ?? null,
        receiver_project_id: body.receiver_project_id ?? null,
        status:              'active',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('*, requester_account_id, requester_team_id, requester_team_name, requester_email, receiver_email, description, color, requester_project_id, receiver_project_id')
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

    // Etapa 8: Create separate isolated teams for Host and Invitee
    // Connected Teams Project binding: use active Projects instead of creating dedicated ones
    try {
      // Check if isolated teams already exist (prevent duplicates on retry)
      if (!data.host_isolated_team_id || !data.invitee_isolated_team_id) {
        // Fetch requester team to get default provider/model
        const { data: requesterTeam } = await createAdminClient()
          .from('teams')
          .select('workspaces(agent_sessions(provider, model)), project_id')
          .eq('id', data.requester_team_id)
          .single()

        // Get provider/model from requester team's first agent_session
        const firstSession = requesterTeam?.workspaces?.[0]?.agent_sessions?.[0]
        const defaultProvider = firstSession?.provider || 'Anthropic'
        const defaultModel = firstSession?.model || 'Claude 3.5 Sonnet'

        // Use requester_project_id from team_connections (persisted at request time)
        // Fallback for legacy pending requests: use project_id of the host team
        let hostProjectId = data.requester_project_id
        if (!hostProjectId) {
          console.warn('[accept] Legacy pending request without requester_project_id. Using fallback: host team project_id.')
          hostProjectId = requesterTeam?.project_id ?? null
        }

        // Use receiver_project_id from accept payload (invitee's active Project)
        const inviteeProjectId = data.receiver_project_id

        if (!hostProjectId || !inviteeProjectId) {
          console.error('[accept] Missing project IDs. host:', hostProjectId, 'invitee:', inviteeProjectId)
          return NextResponse.json(
            { error: 'Failed to create isolated teams. Missing project binding.' },
            { status: 500 }
          )
        }

        // Validate that both projects exist (defense against stale/deleted projects)
        const { data: hostProjectCheck } = await createAdminClient()
          .from('projects')
          .select('id')
          .eq('id', hostProjectId)
          .single()

        const { data: inviteeProjectCheck } = await createAdminClient()
          .from('projects')
          .select('id')
          .eq('id', inviteeProjectId)
          .single()

        if (!hostProjectCheck || !inviteeProjectCheck) {
          console.error('[accept] Project validation failed. host:', !!hostProjectCheck, 'invitee:', !!inviteeProjectCheck)
          return NextResponse.json(
            { error: 'Failed to create isolated teams. Invalid project reference.' },
            { status: 500 }
          )
        }

        // Create Host's isolated team (uses requester's active Project)
        const hostTeamName = `Shared: ${data.requester_team_name} ↔ ${data.receiver_email ?? user.email}`
        const { data: hostTeam } = await createAdminClient()
          .from('teams')
          .insert({
            project_id: hostProjectId,
              name: hostTeamName,
              type: 'isolated',
              parent_id: null,
              description: data.description ?? `Shared workspace with ${data.receiver_email ?? user.email}`,
              color: data.color ?? '#000000',
            })
            .select()
            .single()

          // Create Invitee's isolated team (uses receiver's active Project)
          const inviteeTeamName = `Shared: ${data.receiver_email ?? user.email} ↔ ${data.requester_email}`
          const { data: inviteeTeam } = await createAdminClient()
            .from('teams')
            .insert({
              project_id: inviteeProjectId,
              name: inviteeTeamName,
              type: 'isolated',
              parent_id: null,
              description: data.description ?? `Shared workspace with ${data.requester_email}`,
              color: data.color ?? '#000000',
            })
            .select()
            .single()

          if (hostTeam && inviteeTeam) {
              // Create workspace for Host
              const { data: hostWorkspace } = await createAdminClient()
                .from('workspaces')
                .insert({
                  team_id: hostTeam.id,
                  name: `Workspace ${hostTeamName}`,
                })
                .select()
                .single()

              // Create workspace for Invitee
              const { data: inviteeWorkspace } = await createAdminClient()
                .from('workspaces')
                .insert({
                  team_id: inviteeTeam.id,
                  name: `Workspace ${inviteeTeamName}`,
                })
                .select()
                .single()

            if (hostWorkspace && inviteeWorkspace) {
              // Create 3 agent_sessions for Host
              await createAdminClient().from('agent_sessions').insert([
                {
                  workspace_id: hostWorkspace.id,
                  agent_role: 'manager',
                  provider: defaultProvider,
                  model: defaultModel,
                },
                {
                  workspace_id: hostWorkspace.id,
                  agent_role: 'worker1',
                  provider: defaultProvider,
                  model: defaultModel,
                },
                {
                  workspace_id: hostWorkspace.id,
                  agent_role: 'worker2',
                  provider: defaultProvider,
                  model: defaultModel,
                },
              ])

              // Create 3 agent_sessions for Invitee
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

              // Update team_connections with both isolated team IDs
              await createAdminClient()
                .from('team_connections')
                .update({
                  host_isolated_team_id: hostTeam.id,
                  invitee_isolated_team_id: inviteeTeam.id,
                })
                .eq('id', params.id)
            }
          }
        }
    } catch (isolatedTeamError) {
      // Fail-open: log error but don't block accept
      console.error('[accept] Failed to create isolated teams:', isolatedTeamError)
    }

    // Revalidate Teams Map and Dashboard to show new isolated team
    revalidatePath('/teams')
    revalidatePath('/')

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
