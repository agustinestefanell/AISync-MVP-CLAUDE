import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { connectionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { connectionId } = body

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
  }

  // Verify ownership: user must be the receiver of this connection
  const { data: connection, error: fetchError } = await supabase
    .from('team_connections')
    .select('id, receiver_account_id')
    .eq('id', connectionId)
    .eq('receiver_account_id', user.id)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found or unauthorized' }, { status: 404 })
  }

  // Update welcome_viewed_by_invitee flag
  const { error: updateError } = await supabase
    .from('team_connections')
    .update({ welcome_viewed_by_invitee: true })
    .eq('id', connectionId)

  if (updateError) {
    console.error('Failed to update welcome flag:', updateError)
    return NextResponse.json({ error: 'Failed to update welcome flag' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
