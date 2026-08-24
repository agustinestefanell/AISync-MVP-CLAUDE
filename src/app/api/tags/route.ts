import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// User Library (2026-08-21) — tags manuales libres del usuario.
// GET  → lista de tags de la cuenta (para el multi-select del modal de Save
//        Selection y para User Library).
// POST → crea un tag nuevo ("+ Create new tag" inline del modal). Si el
//        nombre ya existe para esta cuenta (UNIQUE account_id,name), devuelve
//        el tag existente en vez de un error — el usuario no tiene forma de
//        saber de antemano si un nombre ya fue usado.

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data, error } = await supabase
    .from('tags')
    .select('id, name, color')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Tag name is required.' }, { status: 400 })

  const { data, error } = await supabase
    .from('tags')
    .insert({ account_id: user.id, name })
    .select('id, name, color')
    .single()

  if (error) {
    // 23505 = unique_violation (account_id, name) — el tag ya existe, devolverlo
    // en vez de fallar: el usuario no puede saber de antemano si ya lo creó.
    if (error.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('account_id', user.id)
        .eq('name', name)
        .single()
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
      return NextResponse.json(existing)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
