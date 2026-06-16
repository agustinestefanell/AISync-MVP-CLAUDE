'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createProjectAction } from '@/app/actions'
import type { ProjectWithTeams } from '@/lib/db/types'
import ConnectTeamModal, { type Connection } from '@/components/teams/ConnectTeamModal'
import IncomingRequestsPanel from '@/components/teams/IncomingRequestsPanel'
import HowConnectedTeamsModal from '@/components/teams/HowConnectedTeamsModal'

const AGENT_META: Record<string, { label: string; color: string }> = {
  manager: { label: 'Manager', color: 'text-gray-600' },
  worker1: { label: 'Worker 1', color: 'text-gray-600' },
  worker2: { label: 'Worker 2', color: 'text-gray-600' },
}

export default function ProjectList({ projects }: { projects: ProjectWithTeams[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm,          setShowForm]          = useState(false)
  const [name,              setName]              = useState('')
  const [connections,       setConnections]       = useState<Connection[]>([])
  const [showConnectModal,  setShowConnectModal]  = useState(false)
  const [showRequestsPanel, setShowRequestsPanel] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)
  const [disconnecting,     setDisconnecting]     = useState<string | null>(null)
  const [disconnectError,   setDisconnectError]   = useState('')
  const [activeProjectId,   setActiveProjectId]   = useState<string | null>(null)
  const [switchingProject,  setSwitchingProject]  = useState<string | null>(null)
  const [switchError,       setSwitchError]       = useState('')
  const [showHowModal,      setShowHowModal]      = useState(false)
  const [archivingProject,  setArchivingProject]  = useState<string | null>(null)
  const [deletingProject,   setDeletingProject]   = useState<string | null>(null)
  const [confirmDelete,     setConfirmDelete]     = useState<string | null>(null)
  const [projectError,      setProjectError]      = useState('')

  const fetchConnections = useCallback(() => {
    fetch('/api/connections')
      .then(r => r.json())
      .then(data => setConnections(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const fetchActiveProject = useCallback(() => {
    fetch('/api/projects/active')
      .then(r => r.json())
      .then(data => setActiveProjectId(data?.projectId ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchConnections(); fetchActiveProject() }, [fetchConnections, fetchActiveProject])

  // Realtime subscription for connection changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-connections-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_connections'
      }, () => {
        fetchConnections()
      })
      .subscribe()

    // Fallback polling every 15s in case realtime misses cross-account events
    const interval = setInterval(fetchConnections, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchConnections])

  async function setActiveProject(projectId: string) {
    if (projectId === activeProjectId || switchingProject) return
    setSwitchingProject(projectId)
    setSwitchError('')
    try {
      const res = await fetch('/api/projects/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setSwitchError(d?.error ?? 'Failed to switch project.')
        return
      }
      setActiveProjectId(projectId)
      router.refresh()
    } catch {
      setSwitchError('Network error. Please try again.')
    } finally {
      setSwitchingProject(null)
    }
  }

  function handleCreate() {
    if (!name.trim() || isPending) return
    startTransition(async () => {
      await createProjectAction(name)
      setName('')
      setShowForm(false)
      router.refresh()
    })
  }

  async function handleDisconnect(id: string) {
    setDisconnecting(id)
    setDisconnectError('')
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setDisconnectError(d?.error ?? 'Failed to disconnect. Please try again.')
        return
      }
      setConfirmDisconnect(null)
      fetchConnections()
    } catch {
      setDisconnectError('Network error. Please try again.')
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleArchive(projectId: string) {
    console.log('[ProjectList] handleArchive called:', projectId)
    setArchivingProject(projectId)
    setProjectError('')
    try {
      console.log('[ProjectList] Fetching PATCH /api/projects/' + projectId)
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      console.log('[ProjectList] Archive response:', res.status, res.ok)
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setProjectError(d?.error ?? 'Failed to archive project.')
        return
      }
      router.refresh()
    } catch {
      setProjectError('Network error. Please try again.')
    } finally {
      setArchivingProject(null)
    }
  }

  async function handleDelete(projectId: string) {
    console.log('[ProjectList] handleDelete called:', projectId)
    setDeletingProject(projectId)
    setProjectError('')
    try {
      console.log('[ProjectList] Fetching DELETE /api/projects/' + projectId)
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      console.log('[ProjectList] Delete response:', res.status, res.ok)
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setProjectError(d?.error ?? 'Failed to delete project.')
        return
      }
      setConfirmDelete(null)
      console.log('[ProjectList] Calling router.refresh() after delete')
      router.refresh()
      // Force a hard refresh after delete to ensure UI updates
      setTimeout(() => window.location.reload(), 500)
    } catch {
      setProjectError('Network error. Please try again.')
    } finally {
      setDeletingProject(null)
    }
  }

  const activeConnections   = connections.filter(c => c.status === 'active')
  const pendingIncoming     = connections.filter(c => c.status === 'pending' && c.direction === 'incoming')
  const pendingIncomingCount = pendingIncoming.length

  const allTeams = projects.flatMap(p => p.teams)

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

        {switchError && (
          <p className="text-xs text-red-600">{switchError}</p>
        )}

        {projectError && (
          <p className="text-xs text-red-600">{projectError}</p>
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
              <div className="flex items-center gap-2">
                {project.id === activeProjectId ? (
                  <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                    active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setActiveProject(project.id) }}
                    disabled={switchingProject !== null}
                    className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {switchingProject === project.id ? 'Switching…' : 'Set active'}
                  </button>
                )}

                {/* Archive button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleArchive(project.id) }}
                  disabled={archivingProject === project.id}
                  className="text-xs text-gray-500 hover:text-amber-600 disabled:opacity-50 px-2 py-1 transition-colors"
                  title="Archive project"
                >
                  {archivingProject === project.id ? '...' : 'Archive'}
                </button>

                {/* Delete button */}
                {confirmDelete === project.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600">Are you sure?</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleDelete(project.id) }}
                      disabled={deletingProject === project.id}
                      className="text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-2 py-1 rounded transition-colors"
                    >
                      {deletingProject === project.id ? '...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setConfirmDelete(project.id) }}
                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 transition-colors"
                    title="Delete project permanently"
                  >
                    Delete
                  </button>
                )}
              </div>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-[var(--color-text-secondary)]">Connected Teams</h2>
            <button
              onClick={() => setShowHowModal(true)}
              className="text-left text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              How Connected Teams work
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowRequestsPanel(true)}
              className="relative border border-gray-300 text-gray-600 rounded-full px-3 py-1 text-sm hover:bg-gray-50 transition-colors"
            >
              Requests
              {pendingIncomingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowConnectModal(true)}
              className="border border-teal-400 text-teal-600 rounded-full px-3 py-1 text-sm hover:bg-teal-50 transition-colors"
            >
              + Connect
            </button>
          </div>
        </div>

        {activeConnections.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">There are no connected teams yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConnections.map(c => {
              const teamName    = c.direction === 'outgoing'
                ? (c.receiver_team_name ?? c.receiver_email)
                : c.requester_team_name
              const partnerEmail = c.direction === 'outgoing' ? c.receiver_email : c.requester_email
              const isConfirming = confirmDisconnect === c.id

              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{teamName}</p>
                      <p className="text-xs text-gray-400 truncate">{partnerEmail}</p>
                      {c.description && (
                        <p className="text-xs text-gray-500 mt-1 italic">{c.description}</p>
                      )}
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        c.direction === 'outgoing'
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-purple-700 bg-purple-50 border-purple-200'
                      }`}>
                        {c.direction}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={
                          c.scope_isolated_workspace_id
                            ? `/workspace/${c.scope_isolated_workspace_id}`
                            : c.scope_isolated_team?.workspaces?.[0]?.id
                              ? `/workspace/${c.scope_isolated_team.workspaces[0].id}`
                              : '/teams'
                        }
                        className="text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-2.5 py-1 rounded transition-colors"
                      >
                        Open →
                      </Link>
                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => { setConfirmDisconnect(c.id); setDisconnectError('') }}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded border border-gray-200 hover:border-red-200 transition-colors"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="border-t border-gray-100 pt-2 space-y-2">
                      <p className="text-xs text-gray-600">
                        Disconnect <span className="font-medium">{partnerEmail || 'this connected team'}</span>?
                      </p>
                      {disconnectError && (
                        <p className="text-xs text-red-600">{disconnectError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect(c.id)}
                          disabled={disconnecting === c.id}
                          className="flex-1 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-1.5 rounded-lg transition-colors"
                        >
                          {disconnecting === c.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmDisconnect(null); setDisconnectError('') }}
                          className="flex-1 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>

      {showConnectModal && (
        <ConnectTeamModal
          teams={allTeams}
          onClose={() => setShowConnectModal(false)}
          onConnected={() => { setShowConnectModal(false); fetchConnections() }}
        />
      )}

      {showRequestsPanel && (
        <IncomingRequestsPanel
          connections={connections}
          myTeams={allTeams}
          onClose={() => setShowRequestsPanel(false)}
          onAccepted={() => { setShowRequestsPanel(false); fetchConnections() }}
          onRejected={() => { setShowRequestsPanel(false); fetchConnections() }}
        />
      )}

      {showHowModal && (
        <HowConnectedTeamsModal onClose={() => setShowHowModal(false)} />
      )}
    </>
  )
}
