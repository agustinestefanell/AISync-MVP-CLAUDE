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
    return NextResponse.json(
      { error: 'Failed to skip onboarding.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
