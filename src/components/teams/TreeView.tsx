'use client'

import Link from 'next/link'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { ExternalConnection } from './TeamsClient'

const PROVIDER_COLOR: Record<string, string> = {
  Anthropic: 'text-orange-400',
  OpenAI:    'text-green-400',
  Google:    'text-blue-400',
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

interface TreeNode {
  team: TeamWithWorkspaces
  children: TreeNode[]
}

function buildTree(teams: TeamWithWorkspaces[]): TreeNode[] {
  const idSet = new Set(teams.map(t => t.id))
  const map: Record<string, TreeNode> = {}
  for (const t of teams) map[t.id] = { team: t, children: [] }

  const roots: TreeNode[] = []
  for (const t of teams) {
    if (t.parent_id && idSet.has(t.parent_id)) {
      map[t.parent_id].children.push(map[t.id])
    } else {
      roots.push(map[t.id])
    }
  }
  return roots
}

function TeamRow({
  node, depth, connectedTeamIds, onEdit, onDelete,
}: {
  node: TreeNode
  depth: number
  connectedTeamIds: Set<string>
  onEdit: (team: TeamWithWorkspaces) => void
  onDelete: (team: TeamWithWorkspaces) => void
}) {
  const { team } = node
  const workspace = team.workspaces[0] ?? null
  const agents    = workspace?.agent_sessions ?? []
  const connected = connectedTeamIds.has(team.id)

  const satClass = team.type === 'SAT'
    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
    : 'bg-purple-950 text-purple-400 border-purple-800'

  return (
    <>
      <div
        className="flex items-start gap-4 py-4 px-4 rounded-xl hover:bg-gray-900/50 transition-colors border border-transparent hover:border-gray-800"
        style={{ marginLeft: depth * 28 }}
      >
        {depth > 0 && (
          <div className="shrink-0 w-4 h-5 mt-0.5 border-l-2 border-b-2 border-gray-700 rounded-bl-lg" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-bold text-white">{team.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold tracking-wide ${satClass}`}>
              {team.type}
            </span>
            {connected && (
              <span className="text-xs text-teal-400 bg-teal-950 border border-teal-800 px-2 py-0.5 rounded-full font-medium">
                ↔ Connected
              </span>
            )}
          </div>

          {agents.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">
                    {AGENT_LABEL[agent.agent_role] ?? agent.agent_role}:
                  </span>
                  <span className={`text-xs font-semibold ${PROVIDER_COLOR[agent.provider] ?? 'text-gray-400'}`}>
                    {agent.provider}
                  </span>
                  <span className="text-xs text-gray-600">{agent.model}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {workspace && (
            <Link
              href={`/workspace/${workspace.id}`}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
            >
              Open
            </Link>
          )}
          <button
            onClick={() => onEdit(team)}
            className="text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(team)}
            className="text-xs text-red-600 hover:text-red-400 px-2 py-1.5 transition-colors"
            title="Delete team"
          >
            ✕
          </button>
        </div>
      </div>

      {node.children.map(child => (
        <TeamRow
          key={child.team.id}
          node={child}
          depth={depth + 1}
          connectedTeamIds={connectedTeamIds}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

interface TreeViewProps {
  teams: TeamWithWorkspaces[]
  connectedTeamIds: Set<string>
  externalConnections: ExternalConnection[]
  onEdit: (team: TeamWithWorkspaces) => void
  onDelete: (team: TeamWithWorkspaces) => void
}

export default function TreeView({ teams, connectedTeamIds, externalConnections, onEdit, onDelete }: TreeViewProps) {
  const roots = buildTree(teams)

  if (roots.length === 0 && externalConnections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-500 text-sm">No teams in this project.</p>
        <p className="text-gray-700 text-xs mt-1">Use &quot;+ Add Team&quot; to create the first one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 max-w-4xl mx-auto">
      {roots.map(node => (
        <TeamRow
          key={node.team.id}
          node={node}
          depth={0}
          connectedTeamIds={connectedTeamIds}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      {externalConnections.length > 0 && (
        <div className={roots.length > 0 ? 'pt-6 mt-4 border-t border-gray-800' : ''}>
          <p className="text-xs font-medium text-gray-500 mb-3 px-4">
            External connections ({externalConnections.length})
          </p>
          <div className="space-y-2">
            {externalConnections.map(ec => {
              const myTeam = teams.find(t => t.id === ec.myTeamId)
              return (
                <div key={ec.connectionId} className="flex items-center gap-3 bg-teal-950/20 border border-teal-800/50 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{ec.externalTeamName}</span>
                      <span className="text-xs text-teal-400 bg-teal-950 border border-teal-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                        ↔ EXTERNAL
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {ec.externalEmail}
                      {myTeam && (
                        <span className="text-gray-600"> · connected to {myTeam.name}</span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
