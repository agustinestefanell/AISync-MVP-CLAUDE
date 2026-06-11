import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('team_connections')
    .select('*')
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

  const body = await req.json() as {
    requester_team_id: string
    requester_team_name: string
    receiver_email: string
    connection_type?: string
    scope?: string
  }

  const { requester_team_id, requester_team_name, receiver_email } = body

  if (!requester_team_id || !requester_team_name || !receiver_email?.trim()) {
    return NextResponse.json({ error: 'Incomplete data.' }, { status: 400 })
  }

  if (receiver_email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot connect with your own account.' }, { status: 400 })
  }

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
  // Admin client required: accounts RLS only allows reading your own row, so a
  // user-client lookup of another account always returns null. SELECT only —
  // the INSERT below stays on the user client with RLS active.
  const { data: receiverAccount } = await createAdminClient()
    .from('accounts')
    .select('id')
    .eq('email', receiver_email.trim().toLowerCase())
    .single()

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
      receiver_email:       receiver_email.trim().toLowerCase(),
      connection_type:      body.connection_type ?? 'project-bound',
      scope:                body.scope           ?? 'no-shared-repo',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, direction: 'outgoing' }, { status: 201 })
}
