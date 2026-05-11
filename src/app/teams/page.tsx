import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveProjectId, getTeamsForProject } from '@/lib/db/teams'
import { getProjectsWithHierarchy } from '@/lib/db/projects'
import TeamsClient from '@/components/teams/TeamsClient'

export default async function TeamsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = await getActiveProjectId()
  if (!projectId) redirect('/')

  const [projects, teams] = await Promise.all([
    getProjectsWithHierarchy(),
    getTeamsForProject(projectId),
  ])

  const activeProject = projects.find(p => p.id === projectId)

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Operational Elasticity View</span>
          {activeProject && (
            <span className="text-xs text-gray-500 leading-none mt-0.5">{activeProject.name}</span>
          )}
        </div>
        <Link
          href="/audit"
          className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Audit Log →
        </Link>
      </header>

      {/* Teams client (toolbar + view) */}
      <TeamsClient projectId={projectId} initialTeams={teams} />
    </div>
  )
}
