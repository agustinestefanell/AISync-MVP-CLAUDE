import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const AuditClient = dynamic(
  () => import('@/components/audit/AuditClient'),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-gray-500">Loading...</div>,
  }
)
import { getAuditEvents } from '@/lib/db/audit'
import { getProjectsWithHierarchy } from '@/lib/db/projects'

export default async function AuditPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [events, { data: rawCustomProviders }, { data: rawCheckpoints }, projects, { data: account, error: accountError }] = await Promise.all([
    getAuditEvents(),
    supabase.from('user_custom_providers').select('name, model').eq('account_id', user.id).order('created_at'),
    supabase.from('checkpoints').select('id, name'),
    getProjectsWithHierarchy(),
    supabase.from('accounts').select('name').eq('id', user.id).single(),
  ])

  // Ver comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
  // handoff-2026-07-c.md OE 2026-09-04.
  if (accountError) console.error('[AuditPage] accounts query failed:', accountError)

  const customProviders = (rawCustomProviders ?? []) as { name: string; model: string }[]
  const checkpoints     = (rawCheckpoints    ?? []) as { id: string; name: string }[]
  const userName        = (account as { name?: string } | null)?.name ?? user.email ?? '—'

  return (
    <AuditClient
      pageName="AUDIT LOG"
      events={events}
      customProviders={customProviders}
      checkpoints={checkpoints}
      projects={projects}
      userName={userName}
    />
  )
}
