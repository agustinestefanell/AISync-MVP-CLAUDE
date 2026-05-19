import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditClient from '@/components/audit/AuditClient'
import { getAuditEvents } from '@/lib/db/audit'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import AppLayout from '@/components/layout/AppLayout'

export default async function AuditPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [events, { data: rawCustomProviders }, { data: rawCheckpoints }, projects] = await Promise.all([
    getAuditEvents(),
    supabase.from('user_custom_providers').select('name, model').eq('account_id', user.id).order('created_at'),
    supabase.from('checkpoints').select('id, name'),
    getProjectsWithHierarchy(),
  ])

  const customProviders = (rawCustomProviders ?? []) as { name: string; model: string }[]
  const checkpoints     = (rawCheckpoints    ?? []) as { id: string; name: string }[]

  return (
    <AppLayout
      pageName="AUDIT LOG"
      pageSubtitle="How to use Audit Log (click here)"
      scrollable={false}
    >
      <AuditClient
        events={events}
        customProviders={customProviders}
        checkpoints={checkpoints}
        projects={projects}
      />
    </AppLayout>
  )
}
