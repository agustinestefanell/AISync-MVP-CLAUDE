import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDocCheckpoints, getDocAuditEvents, getHandoffPackages, getSavedSelections } from '@/lib/db/documentation'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import DocClient from '@/components/documentation/DocClient'

export default async function DocumentationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, checkpoints, handoffPackages, auditEvents, projects, savedSelections, { data: rawCustomProviders }] = await Promise.all([
    supabase.from('accounts').select('name, email').eq('id', user.id).single(),
    getDocCheckpoints(),
    getHandoffPackages(),
    getDocAuditEvents(),
    getProjectsWithHierarchy(),
    getSavedSelections(user.id),
    supabase.from('user_custom_providers').select('name, model').eq('account_id', user.id).order('created_at'),
  ])

  const customProviders = (rawCustomProviders ?? []) as { name: string; model: string }[]

  const userName  = (account as { name?: string; email?: string } | null)?.name  ?? user.email ?? '—'
  const userEmail = (account as { name?: string; email?: string } | null)?.email ?? user.email ?? '—'

  return (
    <DocClient
      pageName="DOCUMENTATION MODE"
      checkpoints={checkpoints}
      handoffPackages={handoffPackages}
      auditEvents={auditEvents}
      projects={projects}
      savedSelections={savedSelections}
      userName={userName}
      userEmail={userEmail}
      customProviders={customProviders}
    />
  )
}
