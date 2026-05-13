import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDocCheckpoints, getDocAuditEvents, getHandoffPackages } from '@/lib/db/documentation'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import DocClient from '@/components/documentation/DocClient'

export default async function DocumentationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, checkpoints, handoffPackages, auditEvents, projects, { data: rawCustomProviders }] = await Promise.all([
    supabase.from('accounts').select('name, email').eq('id', user.id).single(),
    getDocCheckpoints(),
    getHandoffPackages(),
    getDocAuditEvents(),
    getProjectsWithHierarchy(),
    supabase.from('user_custom_providers').select('name, model').eq('account_id', user.id).order('created_at'),
  ])

  const customProviders = (rawCustomProviders ?? []) as { name: string; model: string }[]

  const userName  = (account as { name?: string; email?: string } | null)?.name  ?? user.email ?? '—'
  const userEmail = (account as { name?: string; email?: string } | null)?.email ?? user.email ?? '—'

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      <header className="shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">DOCUMENTATION MODE</span>
          <span className="text-xs text-gray-500 leading-none mt-0.5">
            Multiple production views over one shared documentary base.
          </span>
        </div>
        <Link href="/audit" className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Audit Log →
        </Link>
      </header>

      <DocClient
        checkpoints={checkpoints}
        handoffPackages={handoffPackages}
        auditEvents={auditEvents}
        projects={projects}
        userName={userName}
        userEmail={userEmail}
        customProviders={customProviders}
      />
    </div>
  )
}
