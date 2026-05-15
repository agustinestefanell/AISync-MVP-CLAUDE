'use client'

import Link from 'next/link'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import type { ExternalConnection } from './TeamsClient'

const ROLE_RIBBON: Record<string, string> = {
  manager:    '#314155',
  submanager: '#314155',
  worker:     '#0f6b68',
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
  node, depth, connectedTeamIds, onEdit,
}: {
  node: TreeNode
  depth: number
  connectedTeamIds: Set<string>
  onEdit: (team: TeamWithWorkspaces) => void
}) {
  const { team } = node
  const workspace = team.workspaces[0] ?? null
  const connected = connectedTeamIds.has(team.id)
  const ribbon    = ROLE_RIBBON[team.lead_role ?? 'worker'] ?? '#52647a'

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: `6px 12px 6px ${12 + depth * 20}px`,
          borderRadius: '6px',
          borderLeft: depth > 0 ? '1px solid #e2e8f0' : 'none',
          marginLeft: depth > 0 ? '12px' : 0,
          cursor: 'default',
        }}
        className="hover:bg-[#f1f5f9] transition-colors"
      >
        {/* Role dot */}
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: ribbon,
          flexShrink: 0,
        }} />

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#1e293b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {team.name}
          </span>
          {connected && (
            <span style={{
              fontSize: '10px',
              color: '#0f766e',
              background: 'rgba(15,118,110,0.08)',
              border: '1px solid rgba(15,118,110,0.20)',
              borderRadius: '20px',
              padding: '0 6px',
              height: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: 500,
              flexShrink: 0,
            }}>
              ↔
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          {workspace && (
            <Link
              href={`/workspace/${workspace.id}`}
              style={{
                height: '26px',
                padding: '0 10px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#fff',
                background: '#1e293b',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
            >
              Open
            </Link>
          )}
          <button
            onClick={() => onEdit(team)}
            style={{
              height: '26px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 400,
              color: '#475569',
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            Edit
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

export default function TreeView({ teams, connectedTeamIds, externalConnections, onEdit }: TreeViewProps) {
  const roots = buildTree(teams)

  if (roots.length === 0 && externalConnections.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '256px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>No teams in this project.</p>
        <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>Use &quot;+ Add Team&quot; to create the first one.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {roots.map(node => (
          <TeamRow
            key={node.team.id}
            node={node}
            depth={0}
            connectedTeamIds={connectedTeamIds}
            onEdit={onEdit}
          />
        ))}
      </div>

      {externalConnections.length > 0 && (
        <div style={{
          marginTop: roots.length > 0 ? '20px' : 0,
          paddingTop: roots.length > 0 ? '16px' : 0,
          borderTop: roots.length > 0 ? '1px solid #e2e8f0' : 'none',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px', padding: '0 12px' }}>
            External connections ({externalConnections.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {externalConnections.map(ec => {
              const myTeam = teams.find(t => t.id === ec.myTeamId)
              return (
                <div
                  key={ec.connectionId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#f0fdf9',
                    border: '1px solid #99f6e4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f766e', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ec.externalTeamName}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#0f766e',
                        background: 'rgba(15,118,110,0.10)',
                        border: '1px solid rgba(15,118,110,0.25)',
                        borderRadius: '20px',
                        padding: '0 6px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}>
                        ↔ EXT
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ec.externalEmail}
                      {myTeam && <span style={{ color: '#94a3b8' }}> · via {myTeam.name}</span>}
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
