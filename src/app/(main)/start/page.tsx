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

  const { data: account } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (account?.onboarding_completed) {
    redirect('/')
  }

  return <ChatFirstClient />
}
