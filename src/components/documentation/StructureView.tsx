'use client'

import { useState, useMemo } from 'react'
import type { DocCheckpoint } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import DocumentationMirrorTree from './DocumentationMirrorTree'

interface Props {
  checkpoints: DocCheckpoint[]
  projects:    ProjectWithTeams[]
  userName:    string
  userEmail:   string
  teamCodes?:  Record<string, string>
}

export default function StructureView({ projects, teamCodes }: Props) {
  const [searchQuery,   setSearchQuery]   = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterArchiveStatus, setFilterArchiveStatus] = useState('')

  const allTeams = useMemo(() => projects.flatMap(p => p.teams), [projects])

  // team id → project id lookup (derived from projects, no invented fields)
  const teamProjectMap = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => p.teams.forEach(t => m.set(t.id, p.id)))
    return m
  }, [projects])

  const mirrorTeams = useMemo(
    () => allTeams.map(t => {
      const code = teamCodes?.[t.id]
      return { teamId: t.id, teamLabel: code ? `${code} · ${t.name}` : t.name, teamStatus: t.status }
    }),
    [allTeams, teamCodes],
  )

  const mirrorAgents = useMemo(
    () => allTeams.flatMap(team => {
      const workspace = team.workspaces[0]
      if (!workspace) return []
      const code = teamCodes?.[team.id]
      const managerSession = workspace.agent_sessions.find(s => s.agent_role === 'manager')
      return workspace.agent_sessions.map(session => {
        const isManager  = session.agent_role === 'manager'
        const isSubMgr   = isManager && team.parent_id !== null
        const roleLabel  = isManager ? (isSubMgr ? 'Sub-Manager' : 'Manager') : 'Worker'
        const agentLabel = code ? `${code} · ${roleLabel}` : roleLabel
        return {
          unitId:           session.id,
          treeParentUnitId: !isManager && managerSession ? managerSession.id : null,
          teamId:           team.id,
          agentLabel,
          agentRole: isManager
            ? (team.parent_id === null ? 'general_manager' : 'senior_manager')
            : 'worker',
          historical: false,
        }
      })
    }),
    [allTeams, teamCodes],
  )

  const filteredMirrorTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return mirrorTeams.filter(team => {
      if (filterProject && teamProjectMap.get(team.teamId) !== filterProject) return false
      if (filterArchiveStatus && team.teamStatus !== filterArchiveStatus) return false
      if (q && !team.teamLabel.toLowerCase().includes(q)) return false
      return true
    })
  }, [mirrorTeams, searchQuery, filterProject, filterArchiveStatus, teamProjectMap])

  const filteredTeamIds = useMemo(
    () => new Set(filteredMirrorTeams.map(t => t.teamId)),
    [filteredMirrorTeams],
  )

  const filteredMirrorAgents = useMemo(
    () => mirrorAgents.filter(agent => filteredTeamIds.has(agent.teamId)),
    [mirrorAgents, filteredTeamIds],
  )

  const rootLabel = projects[0]?.name ?? 'Documentation'

  if (mirrorTeams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-[var(--color-text-secondary)] text-sm">No teams configured yet.</p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            Add teams with workspaces to see the structure.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border-default)] flex flex-wrap gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search teams or agents..."
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[200px]"
        />
        {projects.length > 1 && (
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterArchiveStatus}
          onChange={e => setFilterArchiveStatus(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All team statuses</option>
          <option value="active">Active teams</option>
          <option value="archived">Archived teams</option>
        </select>
        {(searchQuery || filterProject || filterArchiveStatus) && (
          <button
            onClick={() => { setSearchQuery(''); setFilterProject(''); setFilterArchiveStatus('') }}
            className="text-xs text-gray-500 hover:text-gray-600 px-2"
          >
            Reset Search
          </button>
        )}
      </div>

      {/* Tree or filtered empty state */}
      {filteredMirrorTeams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[var(--color-text-muted)] text-sm">No teams match your search.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <DocumentationMirrorTree
            rootLabel={rootLabel}
            teams={filteredMirrorTeams}
            agents={filteredMirrorAgents}
          />
        </div>
      )}
    </div>
  )
}
