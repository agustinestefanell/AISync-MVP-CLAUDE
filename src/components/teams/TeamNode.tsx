'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { useTeamsContext } from './TeamsContext'

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

export interface TeamNodeData {
  team: TeamWithWorkspaces
  connected: boolean
}

export default function TeamNode({ data }: NodeProps) {
  const { team, connected } = data as unknown as TeamNodeData
  const { onOpen, onEdit }  = useTeamsContext()

  const workspace = team.workspaces[0] ?? null
  const agents    = workspace?.agent_sessions ?? []

  const satClass = team.type === 'SAT'
    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
    : 'bg-purple-950 text-purple-400 border-purple-800'

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-72 overflow-hidden hover:border-gray-500 transition-colors">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!bg-gray-600 !border-gray-500 !w-2 !h-2"
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2 bg-gray-900/80">
        <span className="text-sm font-bold text-white truncate leading-tight">{team.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected && (
            <span className="text-xs text-teal-400 bg-teal-950 border border-teal-800 px-1.5 py-0.5 rounded-full font-medium">
              ↔
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${satClass}`}>
            {team.type}
          </span>
        </div>
      </div>

      {/* Agents */}
      <div className="px-4 py-3 space-y-2">
        {agents.length > 0 ? agents.map(agent => (
          <div key={agent.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-[60px] shrink-0">
              {AGENT_LABEL[agent.agent_role] ?? agent.agent_role}
            </span>
            <span className={`text-xs font-semibold ${PROVIDER_COLOR[agent.provider] ?? 'text-gray-400'}`}>
              {agent.provider}
            </span>
            <span className="text-xs text-gray-600 truncate">· {agent.model}</span>
          </div>
        )) : (
          <p className="text-xs text-gray-600 italic">Sin agentes</p>
        )}
      </div>

      {/* Actions — callbacks come from TeamsContext, never through node.data */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {workspace ? (
          <button
            onClick={() => onOpen(workspace.id)}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-lg transition-colors font-semibold"
          >
            Abrir
          </button>
        ) : (
          <span className="flex-1" />
        )}
        <button
          onClick={() => onEdit(team)}
          className="flex-1 text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 py-1.5 rounded-lg transition-colors"
        >
          Editar
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!bg-gray-600 !border-gray-500 !w-2 !h-2"
      />
    </div>
  )
}
