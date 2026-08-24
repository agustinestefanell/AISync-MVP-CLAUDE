import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — "Edit Tag" (panel de tags de User Library, 2026-08-22): renombrar
// y/o cambiar color. RLS (tags_update) ya exige account_id = auth.uid(),
// pero igual filtramos por id explícito para no depender solo de RLS.

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const patch: { name?: string; color?: string } = {}

  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Tag name cannot be empty.' }, { status: 400 })
    patch.name = name
  }
  if (typeof body?.color === 'string' && body.color.trim()) {
    patch.color = body.color.trim()
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tags')
    .update(patch)
    .eq('id', params.id)
    .eq('account_id', user.id)
    .select('id, name, color')
    .single()

  if (error) {
    // 23505 = unique_violation (account_id, name) — ya existe otro tag con ese nombre.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A tag with that name already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Tag not found.' }, { status: 404 })

  return NextResponse.json(data)
}
