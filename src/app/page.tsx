import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import ProjectList from '@/components/ProjectList'
import { getProjectsWithHierarchy } from '@/lib/db/projects'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, projects] = await Promise.all([
    supabase.from('accounts').select('name, email, role').eq('id', user.id).single(),
    getProjectsWithHierarchy(),
  ])

  const isAdmin = ['owner', 'admin'].includes((account as { role?: string } | null)?.role ?? '')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">AISync</span>
        <div className="flex items-center gap-4">
          <a href="/teams" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Teams
          </a>
          <a href="/documentation" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Documentation
          </a>
          <a href="/audit" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Audit Log
          </a>
          <a href="/settings" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Settings
          </a>
          {isAdmin && (
            <a href="/admin" className="text-sm text-amber-500 hover:text-amber-300 transition-colors font-medium">
              Admin
            </a>
          )}
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome{account?.name ? `, ${account.name}` : ''}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{account?.email ?? user.email}</p>
        </div>

        <ProjectList projects={projects} />
      </main>
    </div>
  )
}
