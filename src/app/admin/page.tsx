import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import AdminClient from '@/components/admin/AdminClient'
import {
  getUserMetrics,
  getUsageMetrics,
  getSystemMetrics,
  getAllAccounts,
  getSystemPrompts,
  getAdminEvents,
} from '@/lib/db/admin-metrics'

export default async function AdminPage() {
  // Double server-side verification — never trust middleware alone for sensitive routes
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()
  const { data: account } = await adminDb
    .from('accounts')
    .select('role, email, name')
    .eq('id', user.id)
    .single()

  if (!account || !['owner', 'admin'].includes(account.role)) {
    redirect('/')
  }

  const [userMetrics, usageMetrics, systemMetrics, accounts, prompts, adminEvents] =
    await Promise.all([
      getUserMetrics(),
      getUsageMetrics(),
      getSystemMetrics(),
      getAllAccounts(),
      getSystemPrompts(),
      getAdminEvents(),
    ])

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      <header className="shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-400 text-sm">Admin Panel</span>
        <span className="ml-auto text-xs text-gray-600">
          {account.email} · <span className="text-amber-400 font-semibold">{account.role}</span>
        </span>
      </header>

      <AdminClient
        userMetrics={userMetrics}
        usageMetrics={usageMetrics}
        systemMetrics={systemMetrics}
        accounts={accounts}
        prompts={prompts}
        adminEvents={adminEvents as AdminEvent[]}
      />
    </div>
  )
}

// Local type alias to satisfy AdminClient prop shape
type AdminEvent = {
  id: string
  admin_user_id: string
  action: string
  target_user_id: string | null
  payload: Record<string, unknown>
  created_at: string
}
