import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  // ── Intelligent router ────────────────────────────────────────────────
  // Usuario nuevo → onboarding
  // Usuario existente → dashboard
  if (!account?.onboarding_completed) {
    redirect('/start')
  }

  redirect('/dashboard')
}
