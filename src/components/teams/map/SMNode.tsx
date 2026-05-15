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

export default function SMNode({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData
  const { onOpen, onEdit } = useTeamsContext()
  const pc = PROVIDER_COLOR[d.provider]

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        width: '260px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `3px solid ${d.ribbon}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ background: d.ribbon, borderColor: d.ribbon, width: 8, height: 8, top: -1 }}
      />

      {/* HEADER */}
      <div style={{ padding: '10px 14px', background: d.soft }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '3px',
        }}>
          <span style={{
            fontSize: '10px',
            fontVariant: 'small-caps',
            fontWeight: 600,
            color: d.ribbon,
            opacity: 0.8,
            letterSpacing: '0.05em',
          }}>
            Senior Manager
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#d97706',
            background: 'rgba(217,119,6,0.10)',
            border: '1px solid rgba(217,119,6,0.25)',
            borderRadius: '20px',
            padding: '1px 6px',
          }}>
            ↑ PROMOTED
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#1e293b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {d.teamName}
          </div>
          {d.connected && (
            <span style={{
              fontSize: '9px',
              color: '#0f766e',
              background: 'rgba(15,118,110,0.08)',
              border: '1px solid rgba(15,118,110,0.20)',
              borderRadius: '20px',
              padding: '1px 6px',
              fontWeight: 600,
              flexShrink: 0,
            }}>↔</span>
          )}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          {pc && (
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              height: '20px',
              padding: '0 8px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              color: pc.text,
              background: pc.bg,
              border: `1px solid ${pc.text}30`,
            }}>
              {d.provider}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.model}
          </span>
        </div>
        <p style={{
          fontSize: '12px',
          color: d.teamDescription ? '#64748b' : '#cbd5e1',
          fontStyle: d.teamDescription ? 'normal' : 'italic',
          lineHeight: 1.5,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {d.teamDescription || 'No description.'}
        </p>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '8px 14px', display: 'flex', gap: '6px', background: '#fafafa' }}>
        <button
          onClick={() => onOpen(d.workspaceId)}
          style={{
            flex: 1,
            height: '30px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#fff',
            background: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
        >
          Open
        </button>
        <button
          onClick={() => onEdit(d.teamId)}
          style={{
            flex: 1,
            height: '30px',
            fontSize: '12px',
            fontWeight: 400,
            color: '#475569',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          Edit
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ background: d.ribbon, borderColor: d.ribbon, width: 8, height: 8 }}
      />
    </div>
  )
}
