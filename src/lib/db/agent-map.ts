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
}

export function deriveAgentNodesFromTeams(teams: TeamWithWorkspaces[]): AgentNode[] {
  const nodes: AgentNode[] = []
  for (const team of teams) {
    const workspace = team.workspaces[0]
    if (!workspace) continue
    for (const agent of workspace.agent_sessions) {
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
      })
    }
  }
  return nodes
}
