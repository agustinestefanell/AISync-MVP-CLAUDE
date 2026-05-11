import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'accept' | 'reject'
    receiver_team_id?: string
    receiver_team_name?: string
  }

  if (body.action === 'accept') {
    if (!body.receiver_team_id || !body.receiver_team_name) {
      return NextResponse.json({ error: 'Seleccioná un equipo para aceptar la conexión.' }, { status: 400 })
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

  return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Solo el solicitante puede cancelar, y solo si está pendiente
  const { error } = await supabase
    .from('team_connections')
    .delete()
    .eq('id', params.id)
    .eq('requester_account_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
