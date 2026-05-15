'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { AgentNodeData } from '@/lib/map/buildAgentGraph'
import { useTeamsContext } from '../TeamsContext'

const PROVIDER_COLOR: Record<string, { text: string; bg: string }> = {
  Anthropic: { text: '#c2410c', bg: 'rgba(194,65,12,0.10)' },
  OpenAI:    { text: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },
  Google:    { text: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },
  Groq:      { text: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
}

export default function WorkerNode({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData
  const { onOpen } = useTeamsContext()
  const pc = PROVIDER_COLOR[d.provider]

  const roleLabel = d.agentId.includes('worker2')
    ? 'Worker 2'
    : d.agentId.includes('worker1')
      ? 'Worker 1'
      : 'Worker'

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        width: '220px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `3px solid ${d.ribbon}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ background: d.ribbon, borderColor: d.ribbon, width: 6, height: 6, top: -1 }}
      />

      {/* HEADER */}
      <div style={{ padding: '8px 12px', background: d.soft }}>
        <div style={{
          fontSize: '10px',
          fontVariant: 'small-caps',
          fontWeight: 600,
          color: d.ribbon,
          opacity: 0.8,
          letterSpacing: '0.05em',
          marginBottom: '2px',
        }}>
          {roleLabel}
        </div>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#1e293b',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {d.teamName}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {pc && (
            <span style={{
              fontSize: '10px',
              fontWeight: 500,
              height: '18px',
              padding: '0 7px',
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              color: pc.text,
              background: pc.bg,
              border: `1px solid ${pc.text}30`,
            }}>
              {d.provider}
            </span>
          )}
          <span style={{
            fontSize: '10px',
            color: '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {d.model}
          </span>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '6px 12px', background: '#fafafa' }}>
        <button
          onClick={() => onOpen(d.workspaceId)}
          style={{
            width: '100%',
            height: '28px',
            fontSize: '11px',
            fontWeight: 500,
            color: '#fff',
            background: '#1e293b',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
        >
          Open
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ background: d.ribbon, borderColor: d.ribbon, width: 6, height: 6 }}
      />
    </div>
  )
}
