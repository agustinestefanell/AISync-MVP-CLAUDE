export type ProjectStatus = 'active' | 'archived'
export type TeamType = 'SAT' | 'MAT'
export type LockState = 'unlocked' | 'locked'
export type AgentRole = 'manager' | 'worker1' | 'worker2'

export interface Project {
  id: string
  account_id: string
  name: string
  status: ProjectStatus
  created_at: string
}

export interface Team {
  id: string
  project_id: string
  name: string
  type: TeamType
  parent_id: string | null
  created_at: string
}

export interface Workspace {
  id: string
  team_id: string
  name: string
  lock_state: LockState
  created_at: string
}

export interface AgentSession {
  id: string
  workspace_id: string
  agent_role: AgentRole
  provider: string
  model: string
  config: Record<string, unknown> | null
  created_at: string
}

export interface Checkpoint {
  id: string
  workspace_id: string
  name: string
  purpose: string
  created_at: string
}

export interface CheckpointMessage {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  position: number
}

export interface AuditEvent {
  id: string
  account_id: string
  workspace_id: string | null
  event_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// Tipos enriquecidos para el dashboard (con joins)
export interface WorkspaceWithAgents extends Workspace {
  agent_sessions: AgentSession[]
}

export interface TeamWithWorkspaces extends Team {
  workspaces: WorkspaceWithAgents[]
}

export interface ProjectWithTeams extends Project {
  teams: TeamWithWorkspaces[]
}
