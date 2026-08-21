import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDocCheckpoints, getDocAuditEvents, getHandoffPackages, getSavedSelections, getContextSourcesWithOrigin, getAllMessageProvenance, getContextSourcesScopeStats, getWorkspaceSessionsMap } from '@/lib/db/documentation'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import DocClient from '@/components/documentation/DocClient'

interface Props {
  // Deep-link desde Structure View (WorkspaceDetailPanel, 2026-08-20) — abre
  // directo en Audit/Investigate View con el Team ya filtrado. Ver
  // handoff-2026-07-b.md 2026-08-20.
  searchParams: { tab?: string; team?: string }
}

export default async function DocumentationPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, checkpoints, handoffPackages, auditEvents, projects, savedSelections, contextSourcesWithOrigin, messageProvenance, contextSourcesScopeStats, workspaceSessions, { data: rawCustomProviders }] = await Promise.all([
    supabase.from('accounts').select('name, email').eq('id', user.id).single(),
    getDocCheckpoints(),
    getHandoffPackages(),
    getDocAuditEvents(),
    getProjectsWithHierarchy(),
    getSavedSelections(user.id),
    getContextSourcesWithOrigin(),
    getAllMessageProvenance(),
    getContextSourcesScopeStats(),
    getWorkspaceSessionsMap(),
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
      contextSourcesWithOrigin={contextSourcesWithOrigin}
      messageProvenance={messageProvenance}
      contextSourcesScopeStats={contextSourcesScopeStats}
      workspaceSessions={workspaceSessions}
      userName={userName}
      userEmail={userEmail}
      customProviders={customProviders}
      initialTab={searchParams.tab}
      initialFilterTeam={searchParams.team}
    />
  )
}
