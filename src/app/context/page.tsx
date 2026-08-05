import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContextPageClient from './ContextPageClient'

export default async function ContextPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase.from('accounts').select('name').eq('id', user.id).single()
  const userName = (account as { name?: string } | null)?.name ?? user.email ?? '—'

  return <ContextPageClient pageName="CONTEXT FILES" userId={user.id} userName={userName} />
}
