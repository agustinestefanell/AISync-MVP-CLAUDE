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
import EditTeamModal from '@/components/teams/EditTeamModal'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { getUserIsolatedWorkspaceId } from '@/lib/db/connections'

const AGENT_META: Record<string, { label: string; color: string }> = {
  manager: { label: 'Manager', color: 'text-gray-600' },
  worker1: { label: 'Worker 1', color: 'text-gray-600' },
  worker2: { label: 'Worker 2', color: 'text-gray-600' },
}

function getInitials(email: string, name?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  const parts = email.split('@')[0].split(/[._-]/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function getAvatarColor(id: string): string {
  const colors = [
    'var(--color-accent)', // blue (using brand token)
    '#8B5CF6', // purple
    '#1CB5A3', // teal
    '#F59E0B', // amber
    '#EF4444', // red
    '#10B981', // green
  ]
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
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
  const [editingTeam,       setEditingTeam]       = useState<TeamWithWorkspaces | null>(null)
  const [currentUserId,     setCurrentUserId]     = useState<string | null>(null)
  const [unreadCounts,      setUnreadCounts]      = useState<Record<string, number>>({})
  const [expandedProject,   setExpandedProject]   = useState<string | null>(null)

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

  // Get current user ID for unread calculation
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // Calculate unread counts for active connections
  useEffect(() => {
    if (!currentUserId || connections.length === 0) return

    const supabase = createClient()
    const activeConns = connections.filter(c => c.status === 'active')

    // Fetch unread messages for all active connections
    Promise.all(
      activeConns.map(async (conn) => {
        const lastSeen = Number(
          (typeof window !== 'undefined' && localStorage.getItem(`human-chat-last-seen-${conn.id}`)) || '0'
        )

        const { data } = await supabase
          .from('human_messages')
          .select('id, created_at, from_account_id, to_account_id')
          .eq('connection_id', conn.id)
          .eq('to_account_id', currentUserId)
          .order('created_at', { ascending: false })

        if (!data) return { connectionId: conn.id, count: 0 }

        const unreadMessages = data.filter((msg) => {
          const messageTime = new Date(msg.created_at).getTime()
          return messageTime > lastSeen
        })

        return { connectionId: conn.id, count: unreadMessages.length }
      })
    ).then((results) => {
      const counts = Object.fromEntries(
        results.map((r) => [r.connectionId, r.count])
      )
      setUnreadCounts(counts)
    })
  }, [connections, currentUserId])

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
    setArchivingProject(projectId)
    setProjectError('')
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
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
    setDeletingProject(projectId)
    setProjectError('')
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setProjectError(d?.error ?? 'Failed to delete project.')
        return
      }
      setConfirmDelete(null)
      router.refresh()
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
    <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-6 items-start">

      {/* Left — My Projects */}
      <div className="space-y-4">
        {/* Header with New Project button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0C1733]">My Projects</h2>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            + New Project
          </button>
        </div>

        {switchError && (
          <p className="text-xs text-[#C64F4F]">{switchError}</p>
        )}

        {projectError && (
          <p className="text-xs text-[#C64F4F]">{projectError}</p>
        )}

        {showForm && (
          <div className="bg-white border border-[#DDE6F1] rounded-[18px] shadow-[0_8px_24px_rgba(12,23,51,0.05)] p-5 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Project name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              className="flex-1 bg-[#F8FBFF] border border-[#DDE6F1] rounded-lg px-4 py-2.5 text-sm text-[#0C1733] placeholder-[#8A97AA] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isPending}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setName('') }}
              className="text-[#5C6B82] hover:text-[#0C1733] text-sm px-3 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {projects.length === 0 && (
          <div className="bg-white border border-dashed border-[#DDE6F1] rounded-[18px] p-12 text-center">
            <p className="text-[#8A97AA] text-sm">No projects yet.</p>
            <p className="text-[#8A97AA] text-xs mt-1">Create your first project using the button above.</p>
          </div>
        )}

        {/* Accordion container */}
        {projects.length > 0 && (
          <div className="bg-white border border-[#DDE6F1] rounded-[18px] shadow-[0_8px_24px_rgba(12,23,51,0.05)] overflow-hidden">
            {projects.map((project, idx) => {
              const isExpanded = expandedProject === project.id
              const teamsCount = project.teams.length

              return (
                <div key={project.id} className={idx > 0 ? 'border-t border-[#DDE6F1]' : ''}>
                  {/* Accordion row header */}
                  <button
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                    className="w-full h-14 px-5 flex items-center justify-between hover:bg-[#F8FBFF] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-[#5C6B82] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-base font-semibold text-[#0C1733]">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#5C6B82]">{teamsCount} Team{teamsCount !== 1 ? 's' : ''}</span>
                      {isExpanded && (
                        <span className="text-xs font-medium text-[#2F8A47] bg-[#E9F8EE] px-3 py-1 rounded-full">
                          Open
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="bg-[#F8FBFF] px-5 py-4 space-y-4">
                      {/* Project metadata card */}
                      <div className="bg-white border border-[#DDE6F1] rounded-[18px] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-semibold text-[#0C1733]">{project.name}</h4>
                          <div className="flex items-center gap-2">
                            {project.id === activeProjectId ? (
                              <span className="text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-1.5 rounded-full">
                                Active Project
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveProject(project.id) }}
                                disabled={switchingProject === project.id}
                                className="text-xs font-medium text-[#5C6B82] bg-[#F8FBFF] border border-[#DDE6F1] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-full transition-colors"
                              >
                                {switchingProject === project.id ? 'Switching…' : 'Set as active'}
                              </button>
                            )}
                            <span className="text-xs font-medium text-[#2F8A47] bg-[#DFF4E5] px-3 py-1.5 rounded-full">
                              active
                            </span>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleArchive(project.id) }}
                              disabled={archivingProject === project.id}
                              className="text-sm text-[#5C6B82] hover:text-[#F59E0B] disabled:opacity-50 px-2 transition-colors"
                            >
                              {archivingProject === project.id ? '...' : 'Archive'}
                            </button>
                            {confirmDelete === project.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-[#C64F4F]">Are you sure?</span>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleDelete(project.id) }}
                                  disabled={deletingProject === project.id}
                                  className="text-sm text-white bg-[#C64F4F] hover:bg-[#B03E3E] disabled:opacity-50 px-2 py-1 rounded transition-colors"
                                >
                                  {deletingProject === project.id ? '...' : 'Delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                                  className="text-sm text-[#5C6B82] hover:text-[#0C1733] px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setConfirmDelete(project.id) }}
                                className="text-sm text-[#5C6B82] hover:text-[#C64F4F] px-2 transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Teams list */}
                        <div className="space-y-4">
                          {project.teams.map((team, ti) => (
                            <div key={team.id} className={`space-y-3 ${ti > 0 ? 'pt-4 border-t border-[#DDE6F1]' : ''}`}>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-sm font-medium">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold text-[#0C1733]">{team.name}</span>
                                    <span className="text-xs font-medium text-[#6E7B90] bg-[#F8FBFF] border border-[#D8E2EE] px-2.5 py-1 rounded-full">
                                      {team.type}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingTeam(team) }}
                                  className="text-sm text-[#4E5D75] bg-white hover:bg-[#F8FBFF] border border-[#DDE6F1] px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Edit Team
                                </button>
                              </div>

                              {/* Workspaces */}
                              {team.workspaces.map(ws => (
                                <div key={ws.id} className="ml-11 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <div className="flex items-center gap-2 text-[#5C6B82] mt-0.5">
                                      <span className="text-xs">└──</span>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm text-[#0C1733] font-medium">{ws.name}</span>
                                        <span className="text-xs font-medium text-[#6E7B90] bg-[#F8FBFF] border border-[#D8E2EE] px-2 py-0.5 rounded-full">
                                          {ws.lock_state === 'locked' ? 'locked' : 'free'}
                                        </span>
                                      </div>
                                      {/* Agent list */}
                                      <div className="mt-1.5 space-y-1">
                                        {ws.agent_sessions.map(agent => {
                                          const meta = AGENT_META[agent.agent_role] ?? { label: agent.agent_role, color: 'text-[#5C6B82]' }
                                          return (
                                            <div key={agent.id} className="flex items-center gap-1.5 text-xs text-[#5C6B82]">
                                              <span className="text-[#8A97AA]">•</span>
                                              <span className="font-medium">{meta.label}</span>
                                              <span className="text-[#8A97AA]">·</span>
                                              <span>{agent.model}</span>
                                              <span className="text-[#8A97AA]">({agent.provider})</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                    <Link
                                      href={`/workspace/${ws.id}`}
                                      className="shrink-0 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-4 py-2 rounded-lg transition-colors"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      Open →
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right — Connected Teams */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0C1733]">Connected Teams</h2>
            <p className="text-sm text-[#5C6B82] mt-0.5">Manage your external connections.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowRequestsPanel(true)}
              className="relative bg-white border border-[#DDE6F1] text-[#4E5D75] rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#F8FBFF] transition-colors"
            >
              Requests
              {pendingIncomingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-white border border-[#BFE7C8] text-[#63C37D] rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#E9F8EE] transition-colors"
            >
              + Connect
            </button>
          </div>
        </div>

        {activeConnections.length === 0 ? (
          <div className="bg-white border border-dashed border-[#DDE6F1] rounded-[18px] p-10 text-center">
            <p className="text-[#8A97AA] text-sm">There are no connected teams yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConnections.map(c => {
              const teamName     = c.direction === 'outgoing'
                ? (c.receiver_team_name ?? c.receiver_email)
                : c.requester_team_name
              const partnerEmail = c.direction === 'outgoing' ? c.receiver_email : c.requester_email
              const displayName  = teamName || partnerEmail
              const isConfirming = confirmDisconnect === c.id
              const workspaceId  = currentUserId ? getUserIsolatedWorkspaceId(c, currentUserId) : null
              const initials     = getInitials(partnerEmail, teamName)
              const avatarBg     = getAvatarColor(c.id)

              return (
                <div key={c.id} className="bg-white border border-[#DDE6F1] rounded-[18px] shadow-[0_8px_24px_rgba(12,23,51,0.05)] p-[18px] space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0C1733] truncate">{displayName}</p>
                      <p className="text-xs text-[#8A97AA] truncate">{partnerEmail}</p>
                      {c.description && (
                        <p className="text-xs text-[#5C6B82] mt-1 italic">{c.description}</p>
                      )}
                      <span className={`inline-block mt-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full ${
                        c.direction === 'outgoing'
                          ? 'text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                          : 'text-[#8B5CF6] bg-[#F3EAFF]'
                      }`}>
                        {c.direction === 'outgoing' ? 'Host' : 'Invitee'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isConfirming && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link
                          href={workspaceId ? `/workspace/${workspaceId}` : '/teams'}
                          className="block w-full text-center text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Open →
                        </Link>
                        {(unreadCounts[c.id] ?? 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white">
                            {unreadCounts[c.id]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setConfirmDisconnect(c.id); setDisconnectError('') }}
                        className="text-sm text-[#5C6B82] hover:text-[#C64F4F] px-3 py-2 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}

                  {/* Confirmation */}
                  {isConfirming && (
                    <div className="space-y-2 pt-2 border-t border-[#DDE6F1]">
                      <p className="text-xs text-[#5C6B82]">
                        Disconnect <span className="font-medium text-[#0C1733]">{partnerEmail || 'this connected team'}</span>?
                      </p>
                      {disconnectError && (
                        <p className="text-xs text-[#C64F4F]">{disconnectError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect(c.id)}
                          disabled={disconnecting === c.id}
                          className="flex-1 text-sm font-semibold bg-[#C64F4F] hover:bg-[#B03E3E] disabled:opacity-50 text-white py-2 rounded-lg transition-colors"
                        >
                          {disconnecting === c.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmDisconnect(null); setDisconnectError('') }}
                          className="flex-1 text-sm font-medium border border-[#DDE6F1] text-[#5C6B82] hover:bg-[#F8FBFF] py-2 rounded-lg transition-colors"
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

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          allTeams={allTeams}
          onClose={() => setEditingTeam(null)}
          onUpdated={() => {
            setEditingTeam(null)
            router.refresh()
          }}
          onDeleted={() => {
            setEditingTeam(null)
            router.refresh()
          }}
          onTeamCreated={() => {
            setEditingTeam(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
