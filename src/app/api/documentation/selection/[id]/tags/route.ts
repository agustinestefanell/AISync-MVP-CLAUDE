import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// User Library — edición de tags por card (2026-08-22): "Add Tag" y "Remove
// tag"/"Delete" sobre un Save Selection YA EXISTENTE. Hasta esta OE,
// saved_selection_tags solo se insertaba una vez, al crear el Save Selection
// (save-selection/route.ts) — este endpoint es el único lugar que lo
// modifica después de creado.
//
// POST   { tagIds: string[] }  → agrega tags al Save Selection ("Add Tag").
// DELETE { tagId?: string }    → sin tagId, saca TODOS los tags del Save
//                                 Selection ("Delete" de la card — lo saca de
//                                 User Library sin borrar el Save Selection
//                                 en sí). Con tagId, saca solo ese uno
//                                 ("Remove tag").
//
// Mismo chequeo explícito de ownership que save-selection/route.ts (SEC-008)
// antes de mutar, en vez de depender solo de RLS.

async function assertOwnership(supabase: ReturnType<typeof createClient>, selectionId: string, userId: string) {
  const { data } = await supabase
    .from('saved_selections')
    .select('id')
    .eq('id', selectionId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const tagIds = Array.isArray(body?.tagIds) ? (body.tagIds as unknown[]).filter((t): t is string => typeof t === 'string') : []
  if (tagIds.length === 0) return NextResponse.json({ error: 'tagIds is required.' }, { status: 400 })

  if (!(await assertOwnership(supabase, params.id, user.id))) {
    return NextResponse.json({ error: 'Save Selection not found.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('saved_selection_tags')
    .upsert(
      tagIds.map(tagId => ({ saved_selection_id: params.id, tag_id: tagId })),
      { onConflict: 'saved_selection_id,tag_id', ignoreDuplicates: true },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!(await assertOwnership(supabase, params.id, user.id))) {
    return NextResponse.json({ error: 'Save Selection not found.' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const tagId = typeof body?.tagId === 'string' ? body.tagId : null

  let query = supabase.from('saved_selection_tags').delete().eq('saved_selection_id', params.id)
  if (tagId) query = query.eq('tag_id', tagId)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
