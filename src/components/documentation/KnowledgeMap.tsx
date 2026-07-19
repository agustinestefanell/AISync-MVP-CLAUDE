'use client'

import { useState, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DocCheckpoint } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'

// ── Custom node ────────────────────────────────────────────────────────────
interface DocNodeData { label: string; sub?: string; badge?: string; color: string }

const COLOR_MAP: Record<string, { border: string; bg: string; badge: string }> = {
  project:   { border: 'border-indigo-300',  bg: 'bg-indigo-50',      badge: 'text-indigo-700' },
  team:      { border: 'border-emerald-300', bg: 'bg-emerald-50',     badge: 'text-emerald-700' },
  workspace: { border: 'border-blue-300',    bg: 'bg-blue-50',        badge: 'text-blue-700' },
  checkpoint:{ border: 'border-gray-300',    bg: 'bg-gray-50',        badge: 'text-gray-600' },
}

function DocFlowNode({ data }: NodeProps) {
  const d   = data as unknown as DocNodeData
  const cls = COLOR_MAP[d.color] ?? COLOR_MAP.checkpoint
  return (
    <div className={`border ${cls.border} ${cls.bg} rounded-xl px-3 py-2 w-52 shadow-lg`}>
      <Handle type="target" position={Position.Left}  isConnectable={false} className="!bg-gray-300 !border-gray-400 !w-1.5 !h-1.5" />
      <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight truncate">{d.label}</p>
      {d.sub   && <p className={`text-xs mt-0.5 truncate ${cls.badge}`}>{d.sub}</p>}
      {d.badge && <span className={`text-xs font-bold uppercase tracking-wide ${cls.badge}`}>{d.badge}</span>}
      <Handle type="source" position={Position.Right} isConnectable={false} className="!bg-gray-300 !border-gray-400 !w-1.5 !h-1.5" />
    </div>
  )
}

const NODE_TYPES = { docNode: DocFlowNode }

// ── Layout ─────────────────────────────────────────────────────────────────
const X_STEP = 320
const Y_STEP = 110

function spreadLayout(ids: string[], level: number): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {}
  const totalH = ids.length * Y_STEP
  ids.forEach((id, i) => {
    result[id] = { x: level * X_STEP, y: i * Y_STEP - totalH / 2 }
  })
  return result
}

// ── Graph builders per mode ────────────────────────────────────────────────
type FocusMode = 'documents' | 'teams' | 'projects' | 'workspaces'

function buildDocumentsGraph(cps: DocCheckpoint[]) {
  const wsIds  = Array.from(new Set(cps.map(c => c.workspace_id)))
  const wsPos  = spreadLayout(wsIds, 0)
  const cpIds  = cps.map(c => c.id)
  const cpPos  = spreadLayout(cpIds, 1)
  const wsMap  = new Map(cps.map(c => [c.workspace_id, c.workspace_name]))

  const nodes: Node[] = [
    ...wsIds.map(id => ({
      id, type: 'docNode',
      position: wsPos[id],
      data: { label: wsMap.get(id) ?? id, sub: 'Workspace', color: 'workspace' },
      draggable: true,
    })),
    ...cps.map(c => ({
      id: c.id, type: 'docNode',
      position: cpPos[c.id],
      data: { label: c.name, sub: c.purpose, color: 'checkpoint' },
      draggable: true,
    })),
  ]
  const edges: Edge[] = cps.map(c => ({
    id: `ws-cp-${c.id}`, source: c.workspace_id, target: c.id,
    label: 'GENERATED IN', type: 'smoothstep',
    style: { stroke: '#4b5563', strokeWidth: 1 },
    labelStyle: { fill: '#6b7280', fontSize: 9 },
  }))
  return { nodes, edges }
}

function buildTeamsGraph(cps: DocCheckpoint[]) {
  const projIds = Array.from(new Set(cps.map(c => c.project_id)))
  const teamIds = Array.from(new Set(cps.map(c => c.team_id)))
  const projPos = spreadLayout(projIds, 0)
  const teamPos = spreadLayout(teamIds, 1)
  const projMap = new Map(cps.map(c => [c.project_id, c.project_name]))
  const teamMap = new Map(cps.map(c => [c.team_id, { name: c.team_name, type: c.team_type, projId: c.project_id }]))

  const nodes: Node[] = [
    ...projIds.map(id => ({ id, type: 'docNode', position: projPos[id], data: { label: projMap.get(id) ?? id, sub: 'Project', color: 'project' }, draggable: true })),
    ...teamIds.map(id => {
      const t = teamMap.get(id)!
      return { id, type: 'docNode', position: teamPos[id], data: { label: t.name, badge: t.type, color: 'team' }, draggable: true }
    }),
  ]
  const edges: Edge[] = teamIds.map(id => {
    const t = teamMap.get(id)!
    return { id: `p-t-${id}`, source: t.projId, target: id, label: 'CONTAINS', type: 'smoothstep', style: { stroke: '#4b5563', strokeWidth: 1 }, labelStyle: { fill: '#6b7280', fontSize: 9 } }
  })
  return { nodes, edges }
}

function buildProjectsGraph(cps: DocCheckpoint[]) {
  const projIds = Array.from(new Set(cps.map(c => c.project_id)))
  const projPos = spreadLayout(projIds, 0)
  const projMap = new Map(cps.map(c => [c.project_id, c.project_name]))

  const nodes: Node[] = projIds.map(id => ({
    id, type: 'docNode', position: projPos[id],
    data: { label: projMap.get(id) ?? id, sub: 'Project', color: 'project' },
    draggable: true,
  }))
  return { nodes, edges: [] as Edge[] }
}

function buildWorkspacesGraph(cps: DocCheckpoint[]) {
  const teamIds = Array.from(new Set(cps.map(c => c.team_id)))
  const wsIds   = Array.from(new Set(cps.map(c => c.workspace_id)))
  const teamPos = spreadLayout(teamIds, 0)
  const wsPos   = spreadLayout(wsIds, 1)
  const teamMap = new Map(cps.map(c => [c.team_id, c.team_name]))
  const wsMap   = new Map(cps.map(c => [c.workspace_id, { name: c.workspace_name, teamId: c.team_id }]))

  const nodes: Node[] = [
    ...teamIds.map(id => ({ id, type: 'docNode', position: teamPos[id], data: { label: teamMap.get(id) ?? id, sub: 'Team', color: 'team' }, draggable: true })),
    ...wsIds.map(id => {
      const w = wsMap.get(id)!
      return { id, type: 'docNode', position: wsPos[id], data: { label: w.name, sub: 'Workspace', color: 'workspace' }, draggable: true }
    }),
  ]
  const edges: Edge[] = wsIds.map(id => {
    const w = wsMap.get(id)!
    return { id: `t-w-${id}`, source: w.teamId, target: id, label: 'CONTAINS', type: 'smoothstep', style: { stroke: '#4b5563', strokeWidth: 1 }, labelStyle: { fill: '#6b7280', fontSize: 9 } }
  })
  return { nodes, edges }
}

// ── Component ──────────────────────────────────────────────────────────────
const MODES: { id: FocusMode; label: string }[] = [
  { id: 'documents',  label: 'Documents'  },
  { id: 'teams',      label: 'Teams'      },
  { id: 'projects',   label: 'Projects'   },
  { id: 'workspaces', label: 'Workspaces' },
]

interface Props {
  checkpoints: DocCheckpoint[]
  projects: ProjectWithTeams[]
}

export default function KnowledgeMap({ checkpoints }: Props) {
  const [mode,          setMode]          = useState<FocusMode>('documents')
  const [filterProject, setFilterProject] = useState('')
  const [filterTeam,    setFilterTeam]    = useState('')
  const [filterArchiveStatus, setFilterArchiveStatus] = useState('')

  const uniqueProjects = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.project_id, c.project_name])).entries()), [checkpoints])
  const uniqueTeams    = useMemo(() => Array.from(new Map(checkpoints.map(c => [c.team_id, c.team_name])).entries()), [checkpoints])

  const filtered = useMemo(() => checkpoints.filter(c => {
    if (filterProject && c.project_id !== filterProject) return false
    if (filterTeam    && c.team_id    !== filterTeam)    return false
    if (filterArchiveStatus && c.team_status !== filterArchiveStatus) return false
    return true
  }), [checkpoints, filterProject, filterTeam, filterArchiveStatus])

  const { nodes, edges } = useMemo(() => {
    switch (mode) {
      case 'documents':  return buildDocumentsGraph(filtered)
      case 'teams':      return buildTeamsGraph(filtered)
      case 'projects':   return buildProjectsGraph(filtered)
      case 'workspaces': return buildWorkspacesGraph(filtered)
    }
  }, [mode, filtered])

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  return (
    <div className="h-full flex min-h-0">
      {/* Left panel */}
      <div className="shrink-0 w-64 border-r border-[var(--color-border-subtle)] flex flex-col bg-[var(--color-surface)] px-4 py-5 space-y-6">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Graph Focus Mode</p>
          <div className="space-y-1">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full text-left text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                  mode === m.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Filters</p>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
            <option value="">All projects</option>
            {uniqueProjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
            <option value="">All teams</option>
            {uniqueTeams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={filterArchiveStatus} onChange={e => setFilterArchiveStatus(e.target.value)}
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]">
            <option value="">All team statuses</option>
            <option value="active">Active teams</option>
            <option value="archived">Archived teams</option>
          </select>
          {(filterProject || filterTeam || filterArchiveStatus) && (
            <button onClick={() => { setFilterProject(''); setFilterTeam(''); setFilterArchiveStatus('') }}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] w-full text-left">
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-auto">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Wheel zoom · drag space to pan · drag node to reposition
          </p>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-w-0" style={{ height: 'calc(100vh - 160px)' }}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600 text-sm">No data to display. Save a checkpoint first.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={2}
            colorMode="dark"
            proOptions={proOptions}
          >
            <Background color="#1e293b" gap={24} />
            <Controls
              showInteractive={false}
              className="!bg-white !border-gray-200 !rounded-xl [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600"
            />
            <MiniMap
              nodeColor={(n) => {
                const c = (n.data as unknown as DocNodeData)?.color
                return c === 'project' ? '#4338ca' : c === 'team' ? '#059669' : c === 'workspace' ? '#2563eb' : '#374151'
              }}
              maskColor="rgba(0,0,0,0.65)"
              style={{ background: '#0f172a', border: '1px solid #374151', borderRadius: 8 }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
