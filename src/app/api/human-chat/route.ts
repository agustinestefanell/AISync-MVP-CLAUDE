import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { HumanMessage } from '@/lib/db/types'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const connectionId = searchParams.get('connectionId')

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
  }

  // Verify user is part of this connection
  const { data: connection, error: connError } = await supabase
    .from('team_connections')
    .select('id, requester_account_id, receiver_account_id, status')
    .eq('id', connectionId)
    .eq('status', 'active')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const isParticipant = connection.requester_account_id === user.id || connection.receiver_account_id === user.id

  if (!isParticipant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from('human_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('Failed to fetch human messages:', msgError)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json(messages ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { connectionId?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { connectionId, content } = body

  if (!connectionId || !content || !content.trim()) {
    return NextResponse.json({ error: 'connectionId and content are required' }, { status: 400 })
  }

  // Verify connection exists and is active
  const { data: connection, error: connError } = await supabase
    .from('team_connections')
    .select('id, requester_account_id, receiver_account_id, status')
    .eq('id', connectionId)
    .eq('status', 'active')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found or not active' }, { status: 404 })
  }

  // Determine to_account_id based on who is sending
  const isRequester = connection.requester_account_id === user.id
  const isReceiver = connection.receiver_account_id === user.id

  if (!isRequester && !isReceiver) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const to_account_id = isRequester ? connection.receiver_account_id : connection.requester_account_id

  // Insert message
  const { data: newMessage, error: insertError } = await supabase
    .from('human_messages')
    .insert({
      connection_id: connectionId,
      from_account_id: user.id,
      to_account_id,
      content: content.trim(),
    })
    .select()
    .single()

  if (insertError) {
    console.error('Failed to insert human message:', insertError)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json(newMessage as HumanMessage, { status: 201 })
}
