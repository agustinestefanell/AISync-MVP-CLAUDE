'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import GMNode     from './map/GMNode'
import SMNode     from './map/SMNode'
import WorkerNode from './map/WorkerNode'
import { TeamsContext } from './TeamsContext'
import { deriveAgentNodesFromTeams } from '@/lib/db/agent-map'
import { buildAgentGraph }           from '@/lib/map/buildAgentGraph'
import type { TeamWithWorkspaces }   from '@/lib/db/types'
import type { ExternalConnection }   from './TeamsClient'

const NODE_TYPES = {
  gm_node:     GMNode,
  sm_node:     SMNode,
  worker_node: WorkerNode,
}

const MAP_BG = '#edf1f5'

interface MapViewProps {
  teams: TeamWithWorkspaces[]
  projectId: string
  connectedTeamIds: Set<string>
  externalConnections: ExternalConnection[]
  onEdit: (teamId: string) => void
}

export default function MapView({
  teams,
  connectedTeamIds,
  onEdit,
}: MapViewProps) {
  const router = useRouter()

  const agentNodes = useMemo(
    () => deriveAgentNodesFromTeams(teams),
    [teams],
  )

  const { nodes, edges } = useMemo(
    () => buildAgentGraph(agentNodes, connectedTeamIds),
    [agentNodes, connectedTeamIds],
  )

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  if (agentNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm" style={{ color: '#64748b' }}>No agents in this project yet.</p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Add teams with workspaces and agents to see the map.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <TeamsContext.Provider value={{
        onOpen: (wsId) => router.push(`/workspace/${wsId}`),
        onEdit,
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={proOptions}
          style={{ background: MAP_BG }}
        >
          <Background color="#d1d9e0" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-white !border-gray-200 !rounded-xl [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-500"
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'gm_node') return '#1e293b'
              const d = n.data as { ribbon?: string }
              return d.ribbon ?? '#94a3b8'
            }}
            maskColor="rgba(237,241,245,0.75)"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
          />
        </ReactFlow>
      </TeamsContext.Provider>
    </div>
  )
}
