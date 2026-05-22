import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContextPageClient from './ContextPageClient'

export default async function ContextPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <ContextPageClient userId={user.id} />
}
