import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AuditClient from '@/components/audit/AuditClient'
import { getAuditEvents } from '@/lib/db/audit'

export default async function AuditPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [events, { data: rawCustomProviders }, { data: rawCheckpoints }] = await Promise.all([
    getAuditEvents(),
    supabase.from('user_custom_providers').select('name, model').eq('account_id', user.id).order('created_at'),
    supabase.from('checkpoints').select('id, name'),
  ])

  const customProviders = (rawCustomProviders ?? []) as { name: string; model: string }[]
  const checkpoints     = (rawCheckpoints    ?? []) as { id: string; name: string }[]

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      <header className="shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-400 text-sm">Audit Log</span>
      </header>

      <AuditClient
        events={events}
        customProviders={customProviders}
        checkpoints={checkpoints}
      />
    </div>
  )
}
