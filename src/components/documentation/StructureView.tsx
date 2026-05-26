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

export default function StructureView({ projects }: Props) {
  const allTeams = useMemo(() => projects.flatMap(p => p.teams), [projects])

  const mirrorTeams = useMemo(
    () => allTeams.map(t => ({ teamId: t.id, teamLabel: t.name })),
    [allTeams],
  )

  const mirrorAgents = useMemo(
    () => allTeams.flatMap(team => {
      const workspace = team.workspaces[0]
      if (!workspace) return []
      const managerSession = workspace.agent_sessions.find(s => s.agent_role === 'manager')
      return workspace.agent_sessions.map(session => ({
        unitId:           session.id,
        treeParentUnitId: session.agent_role !== 'manager' && managerSession
          ? managerSession.id
          : null,
        teamId:    team.id,
        agentLabel: session.description
          ?? (session.agent_role === 'manager' ? team.name : `${team.name} · Worker`),
        agentRole: session.agent_role === 'manager'
          ? (team.parent_id === null ? 'general_manager' : 'senior_manager')
          : 'worker',
        historical: false,
      }))
    }),
    [allTeams],
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
