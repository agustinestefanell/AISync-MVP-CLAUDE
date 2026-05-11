'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export interface ExternalTeamNodeData {
  externalTeamName: string
  externalEmail: string
}

export default function ExternalTeamNode({ data }: NodeProps) {
  const { externalTeamName, externalEmail } = data as unknown as ExternalTeamNodeData

  return (
    <div className="bg-teal-950/30 border-2 border-teal-700 rounded-xl shadow-2xl w-72 overflow-hidden">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!bg-teal-600 !border-teal-500 !w-2 !h-2"
      />

      <div className="px-4 py-3 border-b border-teal-800/50 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-white truncate leading-tight">
          {externalTeamName}
        </span>
        <span className="text-xs text-teal-400 bg-teal-950 border border-teal-700 px-2 py-0.5 rounded-full font-bold shrink-0">
          ↔ EXTERNAL
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-teal-500/80">{externalEmail}</p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!bg-teal-600 !border-teal-500 !w-2 !h-2"
      />
    </div>
  )
}
