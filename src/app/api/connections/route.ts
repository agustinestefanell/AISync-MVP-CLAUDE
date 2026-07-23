import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimiters } from '@/lib/rate-limit'
import { CONNECTIONS_SELECT_WITH_ISOLATED_TEAMS } from '@/lib/db/connections'
import { MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT } from '@/lib/constants/connectionLimits'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Etapa 3: Use extended select that includes both new and legacy isolated team fields
  const { data, error } = await supabase
    .from('team_connections')
    .select(CONNECTIONS_SELECT_WITH_ISOLATED_TEAMS)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar dirección para simplificar lógica del cliente
  const connections = (data ?? []).map(c => ({
    ...c,
    direction: c.requester_account_id === user.id ? 'outgoing' : 'incoming',
  }))

  return NextResponse.json(connections)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = await rateLimiters.connections.check(`connections:${user.id}`)
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.reset),
        },
      }
    )
  }

  const body = await req.json() as {
    requester_team_id: string
    requester_team_name: string
    requester_project_id: string
    receiver_email: string
    description: string
    color?: string
    connection_type?: string
    scope?: string
  }

  const { requester_team_id, requester_team_name, requester_project_id, receiver_email, description, color } = body

  if (!requester_team_id || !requester_team_name || !requester_project_id || !receiver_email?.trim()) {
    return NextResponse.json({ error: 'Incomplete data.' }, { status: 400 })
  }

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required.' }, { status: 400 })
  }

  // Validate requester_project_id ownership
  const { data: requesterProject } = await supabase
    .from('projects')
    .select('id')
    .eq('id', requester_project_id)
    .eq('account_id', user.id)
    .single()

  if (!requesterProject) {
    return NextResponse.json(
      { error: 'Invalid project. You do not own this project.' },
      { status: 403 }
    )
  }

  if (receiver_email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot connect with your own account.' }, { status: 400 })
  }

  // Rule 2: Check total active connections count for this account
  const { count: myActiveConnectionsCount } = await supabase
    .from('team_connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(`requester_account_id.eq.${user.id},receiver_account_id.eq.${user.id}`)

  if (myActiveConnectionsCount !== null && myActiveConnectionsCount >= MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT) {
    return NextResponse.json(
      {
        error: 'Connection limit reached',
        message: `You have reached the maximum of ${MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT} active connections for your current plan. Please upgrade your plan or disconnect an existing connection to create a new one.`,
        limit: MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT,
        current: myActiveConnectionsCount,
      },
      { status: 403 }
    )
  }

  // Rule 1: Check for existing active connection between this pair of accounts
  // Must check BOTH directions (A→B and B→A count as the same pair)
  const receiverAccountData = await createAdminClient()
    .from('accounts')
    .select('id, email')
    .eq('email', receiver_email.trim().toLowerCase())
    .single()

  if (!receiverAccountData.data) {
    return NextResponse.json(
      { error: 'No AISync account found with that email.' },
      { status: 400 }
    )
  }

  const receiverAccountId = receiverAccountData.data.id

  const { data: existingPairConnection } = await supabase
    .from('team_connections')
    .select('id, requester_account_id, receiver_account_id, requester_email, receiver_email, requester_project_id, receiver_project_id, requester_team_id, receiver_team_id, host_isolated_team_id, invitee_isolated_team_id')
    .eq('status', 'active')
    .or(`and(requester_account_id.eq.${user.id},receiver_account_id.eq.${receiverAccountId}),and(requester_account_id.eq.${receiverAccountId},receiver_account_id.eq.${user.id})`)
    .maybeSingle()

  if (existingPairConnection) {
    // Determine the workspace ID to redirect to
    // If current user is the requester of the existing connection, use host_isolated_team_id
    // If current user is the receiver of the existing connection, use invitee_isolated_team_id
    const isRequesterInExisting = existingPairConnection.requester_account_id === user.id
    const myIsolatedTeamId = isRequesterInExisting
      ? existingPairConnection.host_isolated_team_id
      : existingPairConnection.invitee_isolated_team_id

    // Get workspace_id from the isolated team
    let workspaceId: string | null = null
    if (myIsolatedTeamId) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('workspaces(id)')
        .eq('id', myIsolatedTeamId)
        .single()

      workspaceId = teamData?.workspaces?.[0]?.id ?? null
    }

    // Get project names for display
    let myProjectName = 'Unknown Project'
    let theirProjectName = 'Unknown Project'

    if (isRequesterInExisting) {
      // I am requester, they are receiver
      if (existingPairConnection.requester_project_id) {
        const { data: myProject } = await supabase
          .from('projects')
          .select('name')
          .eq('id', existingPairConnection.requester_project_id)
          .single()
        myProjectName = myProject?.name ?? 'Unknown Project'
      }
      if (existingPairConnection.receiver_project_id) {
        const { data: theirProject } = await createAdminClient()
          .from('projects')
          .select('name')
          .eq('id', existingPairConnection.receiver_project_id)
          .single()
        theirProjectName = theirProject?.name ?? 'Unknown Project'
      }
    } else {
      // I am receiver, they are requester
      if (existingPairConnection.receiver_project_id) {
        const { data: myProject } = await supabase
          .from('projects')
          .select('name')
          .eq('id', existingPairConnection.receiver_project_id)
          .single()
        myProjectName = myProject?.name ?? 'Unknown Project'
      }
      if (existingPairConnection.requester_project_id) {
        const { data: theirProject } = await createAdminClient()
          .from('projects')
          .select('name')
          .eq('id', existingPairConnection.requester_project_id)
          .single()
        theirProjectName = theirProject?.name ?? 'Unknown Project'
      }
    }

    return NextResponse.json(
      {
        error: 'existing_connection',
        message: 'Already connected with this account',
        existingConnection: {
          connectionId: existingPairConnection.id,
          partnerEmail: receiver_email.trim().toLowerCase(),
          myProjectName,
          theirProjectName,
          workspaceId,
        },
      },
      { status: 409 }
    )
  }

  // Legacy duplicate check (same team + same receiver, pending or active)
  // This is now redundant with Rule 1 but kept for backwards compatibility
  const { data: existing } = await supabase
    .from('team_connections')
    .select('id')
    .eq('requester_team_id', requester_team_id)
    .eq('receiver_email', receiver_email.trim().toLowerCase())
    .in('status', ['pending', 'active'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'An active or pending request already exists for this email and team.' },
      { status: 400 }
    )
  }

  // Gap 1: verify receiver_email belongs to a real AISync account before insert.
  // (Already fetched above in receiverAccountData for Rule 1 check)
  const receiverAccount = receiverAccountData.data

  if (!receiverAccount) {
    return NextResponse.json(
      { error: 'No AISync account found with that email.' },
      { status: 400 }
    )
  }


  const { data, error } = await supabase
    .from('team_connections')
    .insert({
      requester_account_id: user.id,
      requester_email:      user.email!,
      requester_team_id,
      requester_team_name,
      requester_project_id,
      receiver_email:       receiver_email.trim().toLowerCase(),
      description:          description.trim(),
      color:                color || '#000000',
      connection_type:      body.connection_type ?? 'project-bound',
      scope:                body.scope           ?? 'no-shared-repo',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, direction: 'outgoing' }, { status: 201 })
}
