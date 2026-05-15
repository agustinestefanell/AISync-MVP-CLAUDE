'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { useTeamsContext } from './TeamsContext'

const ROLE_RIBBON: Record<string, string> = {
  manager:    '#314155',
  submanager: '#314155',
  worker:     '#0f6b68',
}

const ROLE_SOFT: Record<string, string> = {
  manager:    'rgba(49,65,85,0.08)',
  submanager: 'rgba(49,65,85,0.08)',
  worker:     'rgba(15,107,104,0.08)',
}

const ROLE_LABEL: Record<string, string> = {
  manager:    'Team Manager',
  submanager: 'Sub-Manager',
  worker:     'Team Worker',
}

const PROVIDER_COLOR: Record<string, { text: string; bg: string }> = {
  Anthropic: { text: '#c2410c', bg: 'rgba(194,65,12,0.10)' },
  OpenAI:    { text: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },
  Google:    { text: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },
  Groq:      { text: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
}

export interface TeamNodeData {
  team: TeamWithWorkspaces
  connected: boolean
}

export default function TeamNode({ data }: NodeProps) {
  const { team, connected } = data as unknown as TeamNodeData
  const { onOpen, onEdit }  = useTeamsContext()

  const workspace  = team.workspaces[0] ?? null
  const agents     = workspace?.agent_sessions ?? []
  const leadRole   = team.lead_role ?? 'worker'
  const ribbon     = ROLE_RIBBON[leadRole] ?? '#52647a'
  const soft       = ROLE_SOFT[leadRole]   ?? 'rgba(82,100,122,0.08)'
  const roleLabel  = ROLE_LABEL[leadRole]  ?? 'Team Worker'

  const providers = Array.from(new Set(agents.map(a => a.provider)))

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        width: '260px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `3px solid ${ribbon}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ background: ribbon, borderColor: ribbon, width: 8, height: 8, top: -1 }}
      />

      {/* HEADER */}
      <div style={{ padding: '10px 14px', background: soft }}>
        <div style={{
          fontSize: '10px',
          fontVariant: 'small-caps',
          fontWeight: 600,
          color: ribbon,
          opacity: 0.7,
          letterSpacing: '0.05em',
          marginBottom: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {roleLabel}
          {connected && <span style={{ opacity: 1, fontSize: '11px' }}>↔</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#1e293b',
            lineHeight: 1.3,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {team.name}
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: team.type === 'SAT' ? '#0f766e' : '#7c3aed',
            background: team.type === 'SAT' ? 'rgba(15,118,110,0.10)' : 'rgba(124,58,237,0.10)',
            border: `1px solid ${team.type === 'SAT' ? 'rgba(15,118,110,0.25)' : 'rgba(124,58,237,0.25)'}`,
            borderRadius: '20px',
            padding: '1px 7px',
            whiteSpace: 'nowrap',
            marginTop: '1px',
            flexShrink: 0,
          }}>
            {team.type}
          </span>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        {providers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {providers.map(p => {
              const c = PROVIDER_COLOR[p]
              return (
                <span
                  key={p}
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    height: '20px',
                    padding: '0 8px',
                    borderRadius: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    color:      c?.text ?? '#64748b',
                    background: c?.bg   ?? 'rgba(100,116,139,0.10)',
                    border: `1px solid ${c?.text ?? '#64748b'}30`,
                  }}
                >
                  {p}
                </span>
              )
            })}
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              height: '20px',
              padding: '0 8px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              color: '#94a3b8',
              background: 'rgba(148,163,184,0.10)',
              border: '1px solid rgba(148,163,184,0.20)',
            }}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <p style={{
          fontSize: '12px',
          color: team.description ? '#64748b' : '#cbd5e1',
          fontStyle: team.description ? 'normal' : 'italic',
          lineHeight: 1.5,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {team.description || 'No description yet.'}
        </p>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '8px 14px', display: 'flex', gap: '6px', background: '#fafafa' }}>
        {workspace ? (
          <button
            onClick={() => onOpen(workspace.id)}
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
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
          >
            Open
          </button>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <button
          onClick={() => onEdit(team.id)}
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
            transition: 'background 0.15s',
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
        style={{ background: ribbon, borderColor: ribbon, width: 8, height: 8 }}
      />
    </div>
  )
}
