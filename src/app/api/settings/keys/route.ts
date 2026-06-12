import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_api_keys')
    .select('provider, api_key')
    .eq('account_id', user.id)

  // Devuelve versión enmascarada: nunca el valor real al cliente
  const masked = (data ?? []).map(row => ({
    provider: row.provider,
    masked: '•'.repeat(Math.max(0, row.api_key.length - 4)) + row.api_key.slice(-4),
  }))

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

  const { error } = await supabase.from('user_api_keys').upsert(
    { account_id: user.id, provider, api_key: key.trim(), updated_at: new Date().toISOString() },
    { onConflict: 'account_id,provider' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider is required.' }, { status: 400 })

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('account_id', user.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
