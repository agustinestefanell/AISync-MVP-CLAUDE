import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import ProjectList from '@/components/ProjectList'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import AppLayout from '@/components/layout/AppLayout'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, projects] = await Promise.all([
    supabase.from('accounts').select('name, email, role').eq('id', user.id).single(),
    getProjectsWithHierarchy(),
  ])

  const userName = (account as { name?: string } | null)?.name ?? user.email?.split('@')[0]

  return (
    <AppLayout
      pageName="DASHBOARD"
      pageSubtitle="Your projects and activity"
      userName={userName}
    >
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome{account?.name ? `, ${account.name}` : ''}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">{account?.email ?? user.email}</p>
          </div>
          <LogoutButton />
        </div>

        <ProjectList projects={projects} />
      </div>
    </AppLayout>
  )
}
