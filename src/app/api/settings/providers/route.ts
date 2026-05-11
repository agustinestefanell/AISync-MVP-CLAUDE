import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const RESERVED = new Set(['Anthropic', 'OpenAI', 'Google', 'IA Local'])

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_custom_providers')
    .select('id, name, endpoint_url, model, api_key')
    .eq('account_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Devuelve key enmascarada — nunca el valor real
  const result = (data ?? []).map(p => ({
    id:           p.id,
    name:         p.name,
    endpoint_url: p.endpoint_url,
    model:        p.model,
    masked_key:   '•'.repeat(Math.max(0, p.api_key.length - 4)) + p.api_key.slice(-4),
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, endpoint_url, api_key, model } = await req.json() as {
    name: string
    endpoint_url: string
    api_key: string
    model: string
  }

  if (!name?.trim() || !endpoint_url?.trim() || !api_key?.trim() || !model?.trim()) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 })
  }
  if (RESERVED.has(name.trim())) {
    return NextResponse.json(
      { error: `"${name.trim()}" es un provider reservado del sistema.` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('user_custom_providers').upsert(
    {
      account_id:   user.id,
      name:         name.trim(),
      endpoint_url: endpoint_url.trim(),
      api_key:      api_key.trim(),
      model:        model.trim(),
    },
    { onConflict: 'account_id,name' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 })

  const { error } = await supabase
    .from('user_custom_providers')
    .delete()
    .eq('account_id', user.id)
    .eq('name', name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
