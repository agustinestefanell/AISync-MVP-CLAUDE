import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatFirstClient from '@/components/onboarding/ChatFirstClient'

export default async function StartPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  // Ver comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
  // handoff-2026-07-c.md OE 2026-09-04. Sin este chequeo, un fallo de query
  // dejaba a un usuario con onboarding YA completado varado en /start en vez
  // de redirigir a / — no solo un fallback cosmético de nombre, como en el
  // resto de los call sites de este mismo bug.
  if (accountError) console.error('[StartPage] accounts query failed:', accountError)

  if (account?.onboarding_completed) {
    redirect('/')
  }

  return <ChatFirstClient />
}
