'use client'

import { useMemo, useState, useEffect } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { deriveLighterColor } from '@/lib/teams/deriveTeamColor'
import { resolveTeamColor } from '@/lib/teams/assignTeamColor'

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  projectId: string
  projectName?: string
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
  mainTeamsCount: number
  totalSubteamsCount: number
  totalSessions: number
  totalWorkers: number
  teams: EnrichedTeam[]
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
    color = deriveLighterColor(parentColor, 0.25)
  } else {
    // Team: use team.color or deterministic fallback
    color = resolveTeamColor(team)
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
  projectName,
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
      const mainTeamsCount = enrichedMainTeams.length
      const totalSubteamsCount = enrichedMainTeams.reduce((sum, t) => sum + t.subteams.length, 0)
      const allEnriched = [...enrichedMainTeams, ...enrichedMainTeams.flatMap(t => t.subteams)]
      const totalSessions = allEnriched.reduce((sum, t) => sum + t.sessions, 0)
      const totalWorkers = allEnriched.reduce((sum, t) => sum + t.workers, 0)

      groups.push({
        projectId,
        projectName: projectName ?? 'Untitled Project',
        mainTeamsCount,
        totalSubteamsCount,
        totalSessions,
        totalWorkers,
        teams: enrichedMainTeams,
      })
    }

    return groups
  }, [teams, teamCodes, projectName])

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
      {/* Projects mosaic — column layout */}
      <div
        className="columns-1 xl:columns-2"
        style={{ columnGap: '16px' }}
      >
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
          className="mb-4 break-inside-avoid flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed p-6 text-center transition-colors hover:border-slate-500 hover:bg-white/90 cursor-pointer min-h-[200px]"
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

      {/* Legend */}
      <Legend />
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
      className="mb-4 break-inside-avoid rounded-2xl border p-4"
      style={{
        borderColor: '#BED7F7',
        background: '#FBFDFF',
        boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Project header */}
      <div className="mb-3 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid #D9E2EC', paddingBottom: '8px' }}>
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#10233D' }}>
          {project.projectName.toUpperCase()}
        </h3>
        <div className="flex gap-3 text-xs font-medium" style={{ color: '#64748B' }}>
          <span>Teams: {project.mainTeamsCount}</span>
          <span>Subteams: {project.totalSubteamsCount}</span>
          <span>Sessions: {project.totalSessions}</span>
          <span>Workers: {project.totalWorkers}</span>
        </div>
      </div>

      {/* Teams flex-wrap */}
      <div className="flex flex-wrap items-start gap-3">
        {project.teams.map(enrichedTeam => (
          <TeamColumn
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

function TeamColumn({
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
    <div className="flex w-[180px] flex-col items-stretch">
      {/* Main team card */}
      <div
        className="overflow-hidden rounded-[10px] bg-white"
        style={{
          boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
        }}
      >
        {/* Top color header */}
        <div
          className="px-3 py-2 text-white"
          style={{ backgroundColor: color || '#8E4CC6' }}
        >
          {code && (
            <div className="text-[11px] font-bold uppercase tracking-wide">
              {code}
            </div>
          )}
          <div className="mt-0.5 text-[12px] font-semibold leading-tight">
            {conn?.description || team.name}
          </div>
        </div>

        {/* White body */}
        <div className="p-3">
          {/* Provider + Model */}
          <div className="mb-2">
            <div className="text-[11px] font-bold text-slate-900">{provider}</div>
            <div className="text-[10px] text-slate-600">{model}</div>
          </div>

          {/* SAT/MAT badge */}
          <div className="mb-2">
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {mode}
            </span>
            {isIsolated && (
              <span className="ml-1 rounded bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Shared
              </span>
            )}
          </div>

          {/* Compact metrics */}
          <div className="mb-2 flex gap-2 text-[10px] text-slate-500">
            <span>Workspaces: {workspaces}</span>
            <span>Sessions: {sessions}</span>
            <span>Workers: {workers}</span>
          </div>

          {/* Workers list */}
          {workspace && workspace.agent_sessions && workspace.agent_sessions.length > 0 && (
            <div className="mb-2">
              <div className="text-[9px] font-semibold text-slate-600 mb-1">Team Members:</div>
              <div className="flex flex-wrap gap-1">
                {workspace.agent_sessions.slice(0, 4).map((session, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-700"
                  >
                    {session.agent_role === 'manager' ? 'GM' : `W${idx}`}
                  </span>
                ))}
                {workspace.agent_sessions.length > 4 && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-500">
                    +{workspace.agent_sessions.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1">
            {workspace && (
              <button
                onClick={() => window.open(`/workspace/${workspace.id}`, '_blank', 'noopener,noreferrer')}
                className="flex-1 rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-700 transition-colors"
              >
                Open
              </button>
            )}
            <button
              onClick={() => onEdit(team.id)}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Subteams */}
      {subteams.length > 0 && (
        <div className="relative ml-3 mt-2 border-l-2 border-slate-300 pl-3">
          <div className="space-y-2">
            {subteams.map((subteam, idx) => (
              <SubteamCard
                key={subteam.team.id}
                enrichedTeam={subteam}
                _isLast={idx === subteams.length - 1}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubteamCard({
  enrichedTeam,
  _isLast,
  onEdit,
}: {
  enrichedTeam: EnrichedTeam
  _isLast: boolean
  onEdit: (teamId: string) => void
}) {
  const { team, color, workspaces, sessions, workers, code } = enrichedTeam
  const workspace = team.workspaces?.[0] ?? null

  return (
    <div className="relative">
      {/* Connector horizontal line */}
      <div
        className="absolute left-[-12px] top-3 h-px w-3 bg-slate-300"
        style={{ width: '12px' }}
      />

      <div
        className="overflow-hidden rounded-lg bg-white"
        style={{
          boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
        }}
      >
        {/* Subteam top color header — lighter shade */}
        <div
          className="px-2 py-1.5 text-white"
          style={{ backgroundColor: color || '#C8A8E1' }}
        >
          {code && (
            <div className="text-[9px] font-bold uppercase tracking-wide">
              {code}
            </div>
          )}
          <div className="mt-0.5 text-[10px] font-semibold leading-tight">
            {team.name}
          </div>
        </div>

        {/* White body — compact metrics only */}
        <div className="p-2">
          <div className="mb-1.5 flex gap-2 text-[9px] text-slate-500">
            <span>W: {workspaces}</span>
            <span>S: {sessions}</span>
            <span>Workers: {workers}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            {workspace && (
              <button
                onClick={() => window.open(`/workspace/${workspace.id}`, '_blank', 'noopener,noreferrer')}
                className="flex-1 rounded bg-slate-800 px-2 py-0.5 text-[9px] font-medium text-white hover:bg-slate-600 transition-colors"
              >
                Open
              </button>
            )}
            <button
              onClick={() => onEdit(team.id)}
              className="flex-1 rounded border border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-900">
        Legend
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Block 1 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div
              className="h-6 w-12 rounded"
              style={{ border: '2px solid #BED7F7', background: '#FBFDFF' }}
            />
            <div className="text-xs font-bold text-slate-900">Project = Container</div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Isolates teams, subteams, and project identity.
          </p>
        </div>

        {/* Block 2 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div
              className="h-6 w-6 rounded"
              style={{ background: '#8E4CC6' }}
            />
            <div className="text-xs font-bold text-slate-900">Team = Color</div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Each team has a unique color identity.
          </p>
        </div>

        {/* Block 3 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div
              className="h-6 w-6 rounded"
              style={{ background: '#C8A8E1' }}
            />
            <div className="text-xs font-bold text-slate-900">Subteam = Lighter Shade</div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Nested under parent team with connectors.
          </p>
        </div>

        {/* Block 4 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                WS 2
              </span>
              <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                SES 4
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900">Workspace/Sessions = Compact Metadata</div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Quick view of capacity and activity without expanding the tree.
          </p>
        </div>
      </div>
    </div>
  )
}
