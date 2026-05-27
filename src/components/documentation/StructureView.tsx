'use client'

import { useMemo } from 'react'
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
  const allTeams = useMemo(() => projects.flatMap(p => p.teams), [projects])

  const mirrorTeams = useMemo(
    () => allTeams.map(t => {
      const code = teamCodes?.[t.id]
      return { teamId: t.id, teamLabel: code ? `${code} · ${t.name}` : t.name }
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
    <div className="h-full">
      <DocumentationMirrorTree
        rootLabel={rootLabel}
        teams={mirrorTeams}
        agents={mirrorAgents}
      />
    </div>
  )
}
