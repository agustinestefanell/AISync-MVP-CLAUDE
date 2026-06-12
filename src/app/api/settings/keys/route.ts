import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // SEC-005: key_last4 es la fuente del enmascarado; api_key legacy solo como
  // fallback transicional para filas pre-Vault. Nunca se devuelve la key real.
  const { data } = await supabase
    .from('user_api_keys')
    .select('provider, key_last4, api_key')
    .eq('account_id', user.id)

  const masked = (data ?? []).map(row => {
    const last4 = row.key_last4 ?? (row.api_key ? row.api_key.slice(-4) : '')
    return {
      provider: row.provider,
      masked: last4 ? '••••••••' + last4 : '',
    }
  })

  return NextResponse.json(masked)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, key } = await req.json() as { provider: string; key: string }
  if (!provider || !key?.trim()) {
    return NextResponse.json({ error: 'provider and key are required.' }, { status: 400 })
  }

  // SEC-005: la key va a Vault vía RPC SECURITY DEFINER — nunca más plaintext.
  // Requiere migración 026 aplicada; sin ella este POST falla (sin fallback
  // plaintext deliberadamente).
  const { error } = await supabase.rpc('set_provider_key', {
    p_provider: provider,
    p_key: key.trim(),
  })
  if (error) {
    console.error('[settings/keys] failed to store provider key in Vault', error)
    return NextResponse.json({ error: 'Failed to save provider key.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider is required.' }, { status: 400 })

  // SEC-005: la RPC borra fila + secret en Vault (borrar solo la fila dejaría el
  // secret vivo y huérfano). Fallback al delete legacy si la 026 no está aplicada.
  const { error: rpcError } = await supabase.rpc('delete_provider_key', {
    p_provider: provider,
  })
  if (rpcError) {
    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('account_id', user.id)
      .eq('provider', provider)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
