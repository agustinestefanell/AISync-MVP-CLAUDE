import type { TeamWithWorkspaces } from './types'

export interface AgentNode {
  agentId: string
  role: 'manager' | 'worker1' | 'worker2'
  provider: string
  model: string
  agentDescription: string | null
  workspaceId: string
  workspaceName: string
  teamId: string
  teamName: string
  teamParentId: string | null
  teamType: 'SAT' | 'MAT' | 'isolated'
  teamDescription: string | null
  projectId: string
  connectionDescription?: string | null
  connectionColor?: string | null
}

export interface ConnectionMetadata {
  description: string | null
  color: string | null
}

export function deriveAgentNodesFromTeams(
  teams: TeamWithWorkspaces[],
  connectionMap?: Record<string, ConnectionMetadata>
): AgentNode[] {
  const nodes: AgentNode[] = []

  for (const team of teams) {
    const workspace = team.workspaces[0]
    if (!workspace) continue

    // For isolated teams: prioritize team.description/color (copied at accept),
    // fallback to connectionMap for backward compatibility (teams created before migration 031)
    const connectionData = team.type === 'isolated' && connectionMap
      ? connectionMap[team.id]
      : null

    // For isolated teams (Connected Teams), show only 1 node in Map/Tree View
    // (the first agent_session, typically manager). Normal teams (SAT/MAT) show all sessions.
    const agentsToShow = team.type === 'isolated'
      ? workspace.agent_sessions.slice(0, 1)
      : workspace.agent_sessions

    for (const agent of agentsToShow) {
      // Nodo normal (para todos los teams)
      nodes.push({
        agentId:          agent.id,
        role:             agent.agent_role as 'manager' | 'worker1' | 'worker2',
        provider:         agent.provider,
        model:            agent.model,
        agentDescription: agent.description,
        workspaceId:      workspace.id,
        workspaceName:    workspace.name,
        teamId:           team.id,
        teamName:         team.name,
        teamParentId:     team.parent_id,
        teamType:         team.type,
        teamDescription:  team.description,
        projectId:        team.project_id,
        connectionDescription: team.type === 'isolated' ? (team.description ?? connectionData?.description ?? null) : null,
        connectionColor:       team.type === 'isolated' ? (team.color ?? connectionData?.color ?? null) : null,
      })

      // NUEVO: Para isolated teams, generar nodo worker sintético adicional
      // El manager genera el nodo GM superior, este nodo sintético genera la caja debajo
      if (team.type === 'isolated' && agent.agent_role === 'manager') {
        nodes.push({
          agentId:          `${agent.id}-synthetic-worker`,
          role:             'worker1' as 'manager' | 'worker1' | 'worker2',
          provider:         agent.provider,
          model:            agent.model,
          agentDescription: agent.description,
          workspaceId:      workspace.id,
          workspaceName:    workspace.name,
          teamId:           team.id,
          teamName:         team.name,
          teamParentId:     team.parent_id,
          teamType:         team.type,
          teamDescription:  team.description,
          projectId:        team.project_id,
          connectionDescription: team.description ?? connectionData?.description ?? null,
          connectionColor:       team.color ?? connectionData?.color ?? null,
        })
      }
    }
  }
  return nodes
}
