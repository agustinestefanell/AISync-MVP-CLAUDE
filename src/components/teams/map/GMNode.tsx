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

const GM_BG = '#1e293b'

export default function GMNode({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData
  const { onOpen, onEdit } = useTeamsContext()
  const pc = PROVIDER_COLOR[d.provider]

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        width: '300px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `3px solid ${GM_BG}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* No target handle — GM is the root */}

      {/* HEADER */}
      <div style={{ padding: '12px 14px', background: GM_BG }}>
        <div style={{
          fontSize: '10px',
          fontVariant: 'small-caps',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.06em',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>AI General Manager</span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: d.teamType === 'SAT' ? '#6ee7b7' : '#c4b5fd',
            background: d.teamType === 'SAT' ? 'rgba(52,211,153,0.15)' : 'rgba(167,139,250,0.15)',
            border: `1px solid ${d.teamType === 'SAT' ? 'rgba(52,211,153,0.30)' : 'rgba(167,139,250,0.30)'}`,
            borderRadius: '20px',
            padding: '1px 7px',
            fontVariant: 'normal',
            letterSpacing: 0,
          }}>
            {d.teamType}
          </span>
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {d.teamName}
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
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{d.model}</span>
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
          {d.teamDescription || 'No description yet.'}
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
            background: GM_BG,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.background = GM_BG)}
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
        style={{ background: GM_BG, borderColor: GM_BG, width: 8, height: 8 }}
      />
    </div>
  )
}
