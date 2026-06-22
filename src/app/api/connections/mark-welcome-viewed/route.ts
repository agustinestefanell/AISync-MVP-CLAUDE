import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { connectionId?: string; role?: 'host' | 'invitee' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { connectionId, role } = body

  if (!connectionId || !role) {
    return NextResponse.json({ error: 'connectionId and role are required' }, { status: 400 })
  }

  if (role !== 'host' && role !== 'invitee') {
    return NextResponse.json({ error: 'role must be "host" or "invitee"' }, { status: 400 })
  }

  // Verify ownership: user must be either requester (host) or receiver (invitee) of this connection
  const { data: connection, error: fetchError } = await supabase
    .from('team_connections')
    .select('id, requester_account_id, receiver_account_id')
    .eq('id', connectionId)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const isHost = connection.requester_account_id === user.id
  const isInvitee = connection.receiver_account_id === user.id

  if (!isHost && !isInvitee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Verify role matches user's actual role
  if ((role === 'host' && !isHost) || (role === 'invitee' && !isInvitee)) {
    return NextResponse.json({ error: 'Role mismatch' }, { status: 403 })
  }

  // Update the appropriate welcome flag
  const updateField = role === 'host' ? 'welcome_viewed_by_requester' : 'welcome_viewed_by_invitee'
  const { error: updateError } = await supabase
    .from('team_connections')
    .update({ [updateField]: true })
    .eq('id', connectionId)

  if (updateError) {
    console.error('Failed to update welcome flag:', updateError)
    return NextResponse.json({ error: 'Failed to update welcome flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
