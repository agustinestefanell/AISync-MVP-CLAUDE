import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminClient from '@/components/admin/AdminClient'
import AppLayout from '@/components/layout/AppLayout'
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
    <AppLayout
      pageName="ADMIN PANEL"
      pageSubtitle="Platform management"
      userName={account.name ?? account.email}
      scrollable={false}
    >
      <AdminClient
        userMetrics={userMetrics}
        usageMetrics={usageMetrics}
        systemMetrics={systemMetrics}
        accounts={accounts}
        prompts={prompts}
        adminEvents={adminEvents as AdminEvent[]}
      />
    </AppLayout>
  )
}

type AdminEvent = {
  id: string
  admin_user_id: string
  action: string
  target_user_id: string | null
  payload: Record<string, unknown>
  created_at: string
}
