import { createClient } from '@/lib/supabase/server'
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
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }

  if (receiver_email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'No podés conectarte con tu propia cuenta.' }, { status: 400 })
  }

  // Verificar que no exista ya una conexión activa/pendiente entre estos teams
  const { data: existing } = await supabase
    .from('team_connections')
    .select('id')
    .eq('requester_team_id', requester_team_id)
    .eq('receiver_email', receiver_email.trim().toLowerCase())
    .in('status', ['pending', 'active'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Ya existe una solicitud activa o pendiente con ese email para este equipo.' },
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
