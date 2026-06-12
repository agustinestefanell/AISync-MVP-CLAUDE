import { createClient } from '@/lib/supabase/server'
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
