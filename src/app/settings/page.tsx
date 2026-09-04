import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApiKeysManager from '@/components/settings/ApiKeysManager'
import AppLayout from '@/components/layout/AppLayout'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account, error: accountError } = await supabase.from('accounts').select('name').eq('id', user.id).single()
  // Ver comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
  // handoff-2026-07-c.md OE 2026-09-04.
  if (accountError) console.error('[SettingsPage] accounts query failed:', accountError)
  const userName = (account as { name?: string } | null)?.name ?? user.email ?? '—'

  return (
    <AppLayout
      pageName="SETTINGS"
      pageSubtitle="Configure your account and providers"
      userName={userName}
    >
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Provider configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            API keys are stored in Supabase and only accessible by your account.
          </p>
        </div>

        <ApiKeysManager />
      </div>
    </AppLayout>
  )
}
