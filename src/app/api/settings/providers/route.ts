import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const RESERVED = new Set(['Anthropic', 'OpenAI', 'Google', 'Groq', 'IA Local'])

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // SEC-005: key_last4 como fuente del enmascarado; api_key legacy solo como
  // fallback transicional para filas pre-Vault. Nunca se devuelve la key real.
  const { data, error } = await supabase
    .from('user_custom_providers')
    .select('id, name, endpoint_url, model, key_last4, api_key')
    .eq('account_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map(p => {
    const last4 = p.key_last4 ?? (p.api_key ? p.api_key.slice(-4) : '')
    return {
      id:           p.id,
      name:         p.name,
      endpoint_url: p.endpoint_url,
      model:        p.model,
      masked_key:   last4 ? '••••••••' + last4 : '',
    }
  })

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
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }
  if (RESERVED.has(name.trim())) {
    return NextResponse.json(
      { error: `"${name.trim()}" is a reserved system provider.` },
      { status: 400 }
    )
  }

  // SEC-005: metadata primero (sin la key), key a Vault vía RPC después.
  // Si la RPC falla en una fila existente, su key previa queda intacta.
  const { data: existing } = await supabase
    .from('user_custom_providers')
    .select('id')
    .eq('account_id', user.id)
    .eq('name', name.trim())
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_custom_providers')
      .update({ endpoint_url: endpoint_url.trim(), model: model.trim() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // api_key '' placeholder — la columna legacy es NOT NULL; la key real va a Vault
    const { error } = await supabase.from('user_custom_providers').insert({
      account_id:   user.id,
      name:         name.trim(),
      endpoint_url: endpoint_url.trim(),
      api_key:      '',
      model:        model.trim(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: rpcError } = await supabase.rpc('set_custom_provider_key', {
    p_provider_name: name.trim(),
    p_key: api_key.trim(),
  })
  if (rpcError) {
    console.error('[settings/providers] failed to store custom provider key in Vault', rpcError)
    return NextResponse.json({ error: 'Failed to save provider key.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })

  // SEC-005: la RPC borra fila + secret en Vault. Fallback al delete legacy si
  // la 026 no está aplicada.
  const { error: rpcError } = await supabase.rpc('delete_custom_provider_key', {
    p_provider_name: name,
  })
  if (rpcError) {
    const { error } = await supabase
      .from('user_custom_providers')
      .delete()
      .eq('account_id', user.id)
      .eq('name', name)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
