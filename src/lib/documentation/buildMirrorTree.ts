import type { DocumentationMirrorNode } from './types'

export interface MirrorAgent {
  unitId:           string
  treeParentUnitId: string | null
  teamId:           string
  agentLabel:       string
  agentRole:        string
  historical:       boolean
}

export interface MirrorTeam {
  teamId:    string
  teamLabel: string
}

export interface MirrorTreeInput {
  rootLabel: string
  teams:     MirrorTeam[]
  agents:    MirrorAgent[]
}

function getRoleLabel(role: string): string | undefined {
  if (role === 'general_manager') return 'General Manager'
  if (role === 'senior_manager')  return 'Sub-Manager'
  if (role === 'worker')          return 'Worker'
  return undefined
}

function sortAgents(a: MirrorAgent, b: MirrorAgent): number {
  if (a.agentRole !== b.agentRole) {
    if (a.agentRole === 'senior_manager') return -1
    if (b.agentRole === 'senior_manager') return 1
  }
  return a.agentLabel.localeCompare(b.agentLabel)
}

export function buildDocumentationMirrorTree({ rootLabel, teams, agents }: MirrorTreeInput): DocumentationMirrorNode {
  const byParent: Record<string, MirrorAgent[]> = {}
  for (const agent of agents) {
    const key = agent.treeParentUnitId ?? `team:${agent.teamId}`
    byParent[key] = [...(byParent[key] ?? []), agent]
  }

  const buildBranch = (agent: MirrorAgent): DocumentationMirrorNode => ({
    id:        `agent:${agent.unitId}`,
    kind:      'agent',
    label:     agent.agentLabel,
    path:      `teams/${agent.teamId}/agents/${agent.unitId}`,
    roleLabel: getRoleLabel(agent.agentRole),
    children:  (byParent[agent.unitId] ?? []).sort(sortAgents).map(buildBranch),
  })

  const teamNodes: DocumentationMirrorNode[] = teams
    .slice()
    .sort((a, b) => a.teamLabel.localeCompare(b.teamLabel))
    .map(team => ({
      id:       `team:${team.teamId}`,
      kind:     'team' as const,
      label:    team.teamLabel,
      path:     `teams/${team.teamId}`,
      children: (byParent[`team:${team.teamId}`] ?? []).sort(sortAgents).map(buildBranch),
    }))

  return {
    id:       'docs-root',
    kind:     'root',
    label:    rootLabel,
    path:     rootLabel,
    children: [{
      id:       'docs-folder-teams',
      kind:     'folder',
      label:    'teams',
      path:     `${rootLabel}/teams`,
      children: teamNodes,
    }],
  }
}
