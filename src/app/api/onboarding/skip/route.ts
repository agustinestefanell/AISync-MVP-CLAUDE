import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { error } = await supabase
    .from('accounts')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (error) {
    // Ver comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
    // handoff-2026-07-c.md OE 2026-09-04. Ya propagaba un 500 al cliente
    // (esto no era silencioso) — se agrega el log server-side que faltaba.
    console.error('[PATCH /api/onboarding/skip] accounts update failed:', error)
    return NextResponse.json(
      { error: 'Failed to skip onboarding.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
