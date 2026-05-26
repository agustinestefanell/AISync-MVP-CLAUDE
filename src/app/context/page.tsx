import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContextPageClient from './ContextPageClient'
import AppLayout from '@/components/layout/AppLayout'

export default async function ContextPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppLayout
      pageName="CONTEXT FILES"
      pageSubtitle="Files uploaded to provide context to your AI agents"
      userName={user.email ?? '—'}
    >
      <ContextPageClient userId={user.id} />
    </AppLayout>
  )
}
