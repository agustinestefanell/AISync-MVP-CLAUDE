'use client'

import { useMemo, useState, useEffect } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { deriveLighterColor, getFallbackTeamColor } from '@/lib/teams/deriveTeamColor'

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  projectId: string
  activeProjectId: string
  connectedTeamIds: Set<string>
  teamCodes?: Record<string, string>
  onEdit: (teamId: string) => void
  onConnect: () => void
}

interface EnrichedTeam {
  team: TeamWithWorkspaces
  provider: string
  model: string
  mode: 'SAT' | 'MAT'
  color: string
  workspaces: number
  sessions: number
  workers: number
  code?: string
  subteams: EnrichedTeam[]
}

interface ProjectGroup {
  projectId: string
  projectName: string
  teams: EnrichedTeam[]
  totalTeams: number
  totalSessions: number
  totalWorkers: number
}

function enrichTeam(
  team: TeamWithWorkspaces,
  teamCodes: Record<string, string> | undefined,
  parentColor?: string
): EnrichedTeam {
  // Derive provider/model from manager session
  const managerSession = team.workspaces?.[0]?.agent_sessions?.find(
    (session) => session.agent_role === 'manager'
  )

  const provider = managerSession?.provider ?? 'Unknown'
  const model = managerSession?.model ?? 'Unknown'

  // Calculate metrics
  const workspaces = team.workspaces?.length ?? 0
  const sessions = team.workspaces?.reduce((sum, ws) => sum + (ws.agent_sessions?.length ?? 0), 0) ?? 0
  const workers = team.workspaces?.reduce(
    (sum, ws) => sum + (ws.agent_sessions?.filter(s => s.agent_role?.includes('worker')).length ?? 0),
    0
  ) ?? 0

  // Determine color
  let color: string
  if (parentColor) {
    // Subteam: derive lighter tone from parent
    color = deriveLighterColor(parentColor, 0.4)
  } else if (team.color) {
    // Team has own color
    color = team.color
  } else {
    // Fallback: deterministic from team.id
    color = getFallbackTeamColor(team.id)
  }

  return {
    team,
    provider,
    model,
    mode: team.type === 'SAT' || team.type === 'MAT' ? team.type : 'SAT',
    color,
    workspaces,
    sessions,
    workers,
    code: teamCodes?.[team.id],
    subteams: [], // Populated separately
  }
}

export default function MapView({
  teams,
  activeProjectId,
  teamCodes,
  onEdit,
  onConnect,
}: MapViewProps) {
  // Fetch connection metadata for isolated teams
  const [connectionMap, setConnectionMap] = useState<Record<string, { description: string | null; color: string | null }>>({})

  useEffect(() => {
    const isolatedTeamIds = teams.filter(t => t.type === 'isolated').map(t => t.id)
    if (isolatedTeamIds.length === 0) {
      setConnectionMap({})
      return
    }

    fetch('/api/connections')
      .then(r => r.json())
      .then((connections: Array<{
        host_isolated_team_id?: string | null
        invitee_isolated_team_id?: string | null
        direction: 'outgoing' | 'incoming'
        description?: string | null
        color?: string | null
        status?: string
      }>) => {
        const map: Record<string, { description: string | null; color: string | null }> = {}
        for (const conn of connections) {
          if (conn.status === 'active') {
            const teamId = conn.direction === 'outgoing'
              ? conn.host_isolated_team_id
              : conn.invitee_isolated_team_id

            if (teamId && isolatedTeamIds.includes(teamId)) {
              map[teamId] = {
                description: conn.description ?? null,
                color: conn.color ?? null,
              }
            }
          }
        }
        setConnectionMap(map)
      })
      .catch(() => setConnectionMap({}))
  }, [teams])

  // Build project groups with teams and subteams
  const projectGroups = useMemo((): ProjectGroup[] => {
    // Group teams by project_id
    const grouped = new Map<string, TeamWithWorkspaces[]>()
    for (const team of teams) {
      const pid = team.workspaces?.[0]?.teams?.project_id ?? 'unknown'
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid)!.push(team)
    }

    // Transform each project group
    const groups: ProjectGroup[] = []
    for (const [projectId, projectTeams] of Array.from(grouped.entries())) {
      // Separate main teams (parent_id === null) and subteams
      const mainTeams = projectTeams.filter(t => !t.parent_id)
      const subteamsList = projectTeams.filter(t => t.parent_id)

      // Enrich main teams
      const enrichedMainTeams = mainTeams.map(t => enrichTeam(t, teamCodes))

      // Attach subteams to their parents
      for (const enrichedTeam of enrichedMainTeams) {
        const childSubteams = subteamsList.filter(st => st.parent_id === enrichedTeam.team.id)
        enrichedTeam.subteams = childSubteams.map(st => enrichTeam(st, teamCodes, enrichedTeam.color))
      }

      // Calculate project-level metrics
      const allEnriched = [...enrichedMainTeams, ...enrichedMainTeams.flatMap(t => t.subteams)]
      const totalTeams = allEnriched.length
      const totalSessions = allEnriched.reduce((sum, t) => sum + t.sessions, 0)
      const totalWorkers = allEnriched.reduce((sum, t) => sum + t.workers, 0)

      // Project name fallback
      const projectName = `Project ${projectId.slice(0, 8)}`

      groups.push({
        projectId,
        projectName,
        teams: enrichedMainTeams,
        totalTeams,
        totalSessions,
        totalWorkers,
      })
    }

    return groups
  }, [teams, teamCodes])

  if (projectGroups.length === 0 || projectGroups.every(g => g.teams.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm text-slate-500">No teams in this project yet.</p>
        <p className="text-xs mt-1 text-slate-400">
          Add teams with workspaces and agents to see the map.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto p-6 bg-slate-50">
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2 auto-rows-min">
        {projectGroups.map(project => (
          <ProjectContainer
            key={project.projectId}
            project={project}
            activeProjectId={activeProjectId}
            connectionMap={connectionMap}
            onEdit={onEdit}
          />
        ))}

        {/* Connect Team box */}
        <div
          className="flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed p-6 text-center transition-colors hover:border-slate-500 hover:bg-white/90 cursor-pointer min-h-[200px]"
          style={{
            borderColor: 'rgba(100,116,139,0.45)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(241,245,249,0.92) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 24px rgba(15,23,42,0.05)',
          }}
          onClick={onConnect}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-400 bg-white/85 text-[28px] font-semibold leading-none text-slate-700">
            +
          </div>
          <div className="mt-4 text-[14px] font-semibold text-slate-900">Connect Team</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Link External User</div>
        </div>
      </div>
    </div>
  )
}

function ProjectContainer({
  project,
  activeProjectId,
  connectionMap,
  onEdit,
}: {
  project: ProjectGroup
  activeProjectId: string
  connectionMap: Record<string, { description: string | null; color: string | null }>
  onEdit: (teamId: string) => void
}) {
  const isActive = project.projectId === activeProjectId

  return (
    <section
      className="rounded-2xl border p-5 transition-opacity"
      style={{
        borderColor: '#BED7F7',
        background: '#FBFDFF',
        boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Project header */}
      <div className="mb-4 border-b pb-3" style={{ borderColor: '#D9E2EC' }}>
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#10233D' }}>
          {project.projectName}
        </h3>
        <div className="mt-2 flex gap-4 text-xs" style={{ color: '#64748B' }}>
          <span>Teams: {project.totalTeams}</span>
          <span>Sessions: {project.totalSessions}</span>
          <span>Workers: {project.totalWorkers}</span>
        </div>
      </div>

      {/* Teams grid */}
      <div className="grid gap-3 grid-cols-1">
        {project.teams.map(enrichedTeam => (
          <TeamCardWithSubteams
            key={enrichedTeam.team.id}
            enrichedTeam={enrichedTeam}
            connectionMap={connectionMap}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  )
}

function TeamCardWithSubteams({
  enrichedTeam,
  connectionMap,
  onEdit,
}: {
  enrichedTeam: EnrichedTeam
  connectionMap: Record<string, { description: string | null; color: string | null }>
  onEdit: (teamId: string) => void
}) {
  const { team, provider, model, mode, color, workspaces, sessions, workers, code, subteams } = enrichedTeam
  const workspace = team.workspaces?.[0] ?? null
  const isIsolated = team.type === 'isolated'
  const conn = isIsolated ? connectionMap[team.id] : null

  return (
    <div>
      {/* Main team card */}
      <div
        className="rounded-xl border bg-white p-4 transition-shadow hover:shadow-md"
        style={{
          borderLeft: `4px solid ${color}`,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          borderRight: '1px solid rgba(0,0,0,0.08)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Team code + name */}
            <div className="flex items-center gap-2 mb-2">
              {code && (
                <span className="text-xs font-mono text-slate-500 shrink-0">
                  {code}
                </span>
              )}
              <h4 className="text-sm font-semibold text-slate-900 truncate">
                {conn?.description || team.name}
              </h4>
            </div>

            {/* Provider + Model */}
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-600">
              <span className="font-medium">{provider}</span>
              <span className="text-slate-400">·</span>
              <span>{model}</span>
            </div>

            {/* Metrics */}
            <div className="flex gap-3 text-xs text-slate-500">
              <span>W: {workspaces}</span>
              <span>S: {sessions}</span>
              <span>Workers: {workers}</span>
            </div>
          </div>

          {/* SAT/MAT badge + Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                color: mode === 'SAT' ? '#0f766e' : '#7c3aed',
                background: mode === 'SAT' ? 'rgba(15,118,110,0.10)' : 'rgba(124,58,237,0.10)',
                border: `1px solid ${mode === 'SAT' ? 'rgba(15,118,110,0.25)' : 'rgba(124,58,237,0.25)'}`,
              }}
            >
              {mode}
            </span>

            {isIsolated && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-black text-white">
                Shared
              </span>
            )}

            <div className="flex gap-2">
              {workspace && (
                <button
                  onClick={() => window.open(`/workspace/${workspace.id}`, '_blank', 'noopener,noreferrer')}
                  className="text-xs font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                >
                  Open
                </button>
              )}
              <button
                onClick={() => onEdit(team.id)}
                className="text-xs font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subteams */}
      {subteams.length > 0 && (
        <div className="ml-8 mt-2 space-y-2">
          {subteams.map(subteam => (
            <SubteamCard
              key={subteam.team.id}
              enrichedTeam={subteam}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SubteamCard({
  enrichedTeam,
  onEdit,
}: {
  enrichedTeam: EnrichedTeam
  onEdit: (teamId: string) => void
}) {
  const { team, provider, model, color, workspaces, sessions, workers, code } = enrichedTeam
  const workspace = team.workspaces?.[0] ?? null

  return (
    <div
      className="rounded-lg border bg-white p-3 text-xs"
      style={{
        borderLeft: `3px solid ${color}`,
        borderTop: '1px solid rgba(0,0,0,0.06)',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Subteam code + name */}
          <div className="flex items-center gap-2 mb-1">
            {code && (
              <span className="text-xs font-mono text-slate-400 shrink-0">
                {code}
              </span>
            )}
            <span className="font-medium text-slate-800 truncate">{team.name}</span>
          </div>

          {/* Provider + Model */}
          <div className="text-xs text-slate-500 mb-1">
            {provider} · {model}
          </div>

          {/* Metrics */}
          <div className="flex gap-2 text-xs text-slate-400">
            <span>W: {workspaces}</span>
            <span>S: {sessions}</span>
            <span>Workers: {workers}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          {workspace && (
            <button
              onClick={() => window.open(`/workspace/${workspace.id}`, '_blank', 'noopener,noreferrer')}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-600 transition-colors"
            >
              Open
            </button>
          )}
          <button
            onClick={() => onEdit(team.id)}
            className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
