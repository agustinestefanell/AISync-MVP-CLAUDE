'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProjectAction } from '@/app/actions'
import type { ProjectWithTeams } from '@/lib/db/types'
import ConnectTeamModal from '@/components/teams/ConnectTeamModal'

const AGENT_META: Record<string, { label: string; color: string }> = {
  manager: { label: 'Manager', color: 'text-gray-600' },
  worker1: { label: 'Worker 1', color: 'text-gray-600' },
  worker2: { label: 'Worker 2', color: 'text-gray-600' },
}

type TeamConnection = {
  id: string
  requester_team_name: string
  receiver_team_name?: string | null
  receiver_email: string
  requester_email: string
  status: string
  direction: 'outgoing' | 'incoming'
}

export default function ProjectList({ projects }: { projects: ProjectWithTeams[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [connections,      setConnections]      = useState<TeamConnection[]>([])
  const [showConnectModal, setShowConnectModal] = useState(false)

  const fetchConnections = useCallback(() => {
    fetch('/api/connections')
      .then(r => r.json())
      .then(data => setConnections(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  function handleCreate() {
    if (!name.trim() || isPending) return
    startTransition(async () => {
      await createProjectAction(name)
      setName('')
      setShowForm(false)
      router.refresh()
    })
  }

  const activeConnections = connections.filter(c => c.status === 'active')

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">

      {/* Left — My Projects */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">My Projects</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span aria-hidden>+</span> New Project
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-indigo-300 rounded-xl p-4 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Project name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isPending}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setName('') }}
              className="text-gray-500 hover:text-gray-700 text-sm px-2"
            >
              Cancel
            </button>
          </div>
        )}

        {projects.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-500 text-sm">No projects yet.</p>
            <p className="text-gray-400 text-xs mt-1">Create your first project using the button above.</p>
          </div>
        )}

        {projects.map(project => (
          <div key={project.id} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{project.name}</h3>
              <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                active
              </span>
            </div>

            <div className="text-sm">
              {project.teams.map((team, ti) => (
                <div key={team.id} className={`space-y-2 py-2.5 ${ti > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-mono text-xs">
                      {ti < project.teams.length - 1 ? '├──' : '└──'}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{team.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                      {team.type}
                    </span>
                  </div>

                  {team.workspaces.map(ws => (
                    <div key={ws.id} className="pl-7 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono text-xs">└──</span>
                        <span className="text-gray-600">{ws.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${
                          ws.lock_state === 'locked'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-gray-600 bg-gray-50 border-gray-200'
                        }`}>
                          {ws.lock_state === 'locked' ? 'locked' : 'free'}
                        </span>
                        <Link
                          href={`/workspace/${ws.id}`}
                          className="ml-auto text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-2.5 py-0.5 rounded transition-colors"
                        >
                          Open →
                        </Link>
                      </div>

                      {ws.agent_sessions.map(agent => {
                        const meta = AGENT_META[agent.agent_role] ?? { label: agent.agent_role, color: 'text-gray-600' }
                        return (
                          <div key={agent.id} className="pl-12 flex items-center gap-2 text-xs text-gray-500">
                            <span className="text-gray-400">•</span>
                            <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                            <span className="text-gray-400">·</span>
                            <span>{agent.model}</span>
                            <span className="text-gray-400">({agent.provider})</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right — Connected Teams */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-secondary)]">Connected Teams</h2>
          <button
            onClick={() => setShowConnectModal(true)}
            className="border border-teal-400 text-teal-600 rounded-full px-3 py-1 text-sm hover:bg-teal-50 transition-colors"
          >
            + Connect
          </button>
        </div>

        {activeConnections.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">There are no connected teams yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConnections.map(c => {
              const teamName = c.direction === 'outgoing'
                ? (c.receiver_team_name ?? c.receiver_email)
                : c.requester_team_name
              const partnerEmail = c.direction === 'outgoing' ? c.receiver_email : c.requester_email
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{teamName}</p>
                    <p className="text-xs text-gray-400 truncate">{partnerEmail}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${
                      c.direction === 'outgoing'
                        ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : 'text-purple-700 bg-purple-50 border-purple-200'
                    }`}>
                      {c.direction}
                    </span>
                  </div>
                  <Link
                    href="/teams"
                    className="shrink-0 text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-2.5 py-1 rounded transition-colors"
                  >
                    Open →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>

      {showConnectModal && (
        <ConnectTeamModal
          teams={projects.flatMap(p => p.teams)}
          onClose={() => setShowConnectModal(false)}
          onConnected={() => { setShowConnectModal(false); fetchConnections() }}
        />
      )}
    </>
  )
}
