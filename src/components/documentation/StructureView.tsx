'use client'

import { useState, useMemo } from 'react'
import type { DocCheckpoint } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'

const PURPOSE_BADGE: Record<string, string> = {
  'Checkpoint':     'text-green-400 bg-green-950 border-green-900',
  'Session Backup': 'text-blue-400 bg-blue-950 border-blue-900',
  'Handoff':        'text-purple-400 bg-purple-950 border-purple-900',
  'Evidence':       'text-orange-400 bg-orange-950 border-orange-900',
}

const STATE_BADGE: Record<string, string> = {
  'active':       'text-emerald-400 bg-emerald-950 border-emerald-900',
  'under_review': 'text-yellow-400 bg-yellow-950 border-yellow-900',
  'locked':       'text-red-400 bg-red-950 border-red-900',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function teamLabel(id: string, name: string, codes?: Record<string, string>): string {
  const code = codes?.[id]
  return code ? `${code} · ${name}` : name
}

interface TreeProject {
  id: string
  name: string
  teams: TreeTeam[]
}

interface TreeTeam {
  id: string
  name: string
  type: string
  workspaces: TreeWorkspace[]
}

interface TreeWorkspace {
  id: string
  name: string
  checkpoints: DocCheckpoint[]
}

function buildTree(checkpoints: DocCheckpoint[]): TreeProject[] {
  const projectMap = new Map<string, TreeProject>()
  const teamMap    = new Map<string, TreeTeam>()
  const wsMap      = new Map<string, TreeWorkspace>()

  for (const cp of checkpoints) {
    if (!projectMap.has(cp.project_id)) {
      projectMap.set(cp.project_id, { id: cp.project_id, name: cp.project_name, teams: [] })
    }
    if (!teamMap.has(cp.team_id)) {
      const team: TreeTeam = { id: cp.team_id, name: cp.team_name, type: cp.team_type, workspaces: [] }
      teamMap.set(cp.team_id, team)
      projectMap.get(cp.project_id)!.teams.push(team)
    }
    if (!wsMap.has(cp.workspace_id)) {
      const ws: TreeWorkspace = { id: cp.workspace_id, name: cp.workspace_name, checkpoints: [] }
      wsMap.set(cp.workspace_id, ws)
      teamMap.get(cp.team_id)!.workspaces.push(ws)
    }
    wsMap.get(cp.workspace_id)!.checkpoints.push(cp)
  }

  return Array.from(projectMap.values())
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function DetailPanel({ cp, userName, onClose, teamCodes }: { cp: DocCheckpoint; userName: string; onClose: () => void; teamCodes?: Record<string, string> }) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-950 border-l border-gray-800 z-40 flex flex-col shadow-2xl">
      <div className="shrink-0 px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Document Detail</p>
          <h3 className="text-sm font-bold text-white">{cp.name}</h3>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-sm shrink-0">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {[
          { label: 'State',       value: <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase ${STATE_BADGE[cp.doc_state] ?? STATE_BADGE.active}`}>{cp.doc_state.replace('_',' ')}</span> },
          { label: 'Version',     value: cp.version_label },
          { label: 'Created',     value: formatDate(cp.created_at), suppress: true },
          { label: 'Owner',       value: userName },
          { label: 'Responsible', value: cp.responsible ?? userName },
          { label: 'Sensitivity', value: cp.sensitivity },
          { label: 'Object type', value: cp.object_type },
          { label: 'Team',        value: teamLabel(cp.team_id, cp.team_name, teamCodes) },
          { label: 'Workspace',   value: cp.workspace_name },
          { label: 'Project',     value: cp.project_name },
          { label: 'Purpose',     value: <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PURPOSE_BADGE[cp.purpose] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>{cp.purpose}</span> },
        ].map(({ label, value, suppress }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="text-xs text-gray-600 w-24 shrink-0">{label}</span>
            <span className="text-xs text-gray-300" suppressHydrationWarning={!!suppress}>{value}</span>
          </div>
        ))}
        <div className="pt-2 flex gap-2">
          <a href={`/workspace/${cp.workspace_id}`}
            className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-colors">
            Open Document
          </a>
          <a href="/audit"
            className="flex-1 text-center text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 py-2 rounded-lg transition-colors">
            Audit Log
          </a>
        </div>
      </div>
    </div>
  )
}

interface Props {
  checkpoints: DocCheckpoint[]
  projects:    ProjectWithTeams[]
  userName:    string
  userEmail:   string
  teamCodes?:  Record<string, string>
}

export default function StructureView({ checkpoints, userName, teamCodes }: Props) {
  const tree    = useMemo(() => buildTree(checkpoints), [checkpoints])
  const [expandedProjects,   setExpandedProjects]   = useState<Set<string>>(new Set(tree.map(p => p.id)))
  const [expandedTeams,      setExpandedTeams]      = useState<Set<string>>(new Set(tree.flatMap(p => p.teams.map(t => t.id))))
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set(tree.flatMap(p => p.teams.flatMap(t => t.workspaces.map(w => w.id)))))
  const [selected, setSelected] = useState<DocCheckpoint | null>(null)

  function toggle<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set)
    if (next.has(val)) next.delete(val); else next.add(val)
    return next
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No documents yet.</p>
          <p className="text-gray-700 text-xs mt-1">Save a checkpoint in a workspace to see it here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <p className="text-xs text-gray-600 mb-6">
          Hierarchical provenance view based on the documentary mirror of Teams.
        </p>

        <div className="space-y-3">
          {tree.map(project => (
            <div key={project.id}>
              {/* Project */}
              <button
                onClick={() => setExpandedProjects(toggle(expandedProjects, project.id))}
                className="flex items-center gap-2 text-sm font-bold text-white hover:text-indigo-300 transition-colors w-full text-left"
              >
                <ChevronIcon open={expandedProjects.has(project.id)} />
                <span className="text-gray-600 mr-1">📁</span>
                /{project.name}
              </button>

              {expandedProjects.has(project.id) && (
                <div className="ml-5 mt-2 border-l border-gray-800 pl-4 space-y-3">
                  <p className="text-xs text-gray-600 font-mono">teams/</p>

                  {project.teams.map(team => (
                    <div key={team.id}>
                      {/* Team */}
                      <button
                        onClick={() => setExpandedTeams(toggle(expandedTeams, team.id))}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors w-full text-left"
                      >
                        <ChevronIcon open={expandedTeams.has(team.id)} />
                        <span className="mr-1">📁</span>
                        {teamLabel(team.id, team.name, teamCodes)}
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ml-1 ${
                          team.type === 'SAT' ? 'text-emerald-400 bg-emerald-950 border-emerald-800' : 'text-purple-400 bg-purple-950 border-purple-800'
                        }`}>{team.type}</span>
                      </button>

                      {expandedTeams.has(team.id) && (
                        <div className="ml-5 mt-1 border-l border-gray-800 pl-4 space-y-2">
                          {team.workspaces.map(ws => (
                            <div key={ws.id}>
                              {/* Workspace */}
                              <button
                                onClick={() => setExpandedWorkspaces(toggle(expandedWorkspaces, ws.id))}
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full text-left"
                              >
                                <ChevronIcon open={expandedWorkspaces.has(ws.id)} />
                                <span className="mr-1">📁</span>
                                {ws.name}
                                <span className="text-xs text-gray-600 ml-1">({ws.checkpoints.length})</span>
                              </button>

                              {expandedWorkspaces.has(ws.id) && (
                                <div className="ml-5 mt-1 border-l border-gray-800 pl-4 space-y-1">
                                  {ws.checkpoints.map(cp => (
                                    <button
                                      key={cp.id}
                                      onClick={() => setSelected(cp)}
                                      className="flex items-center gap-2 w-full text-left py-1 hover:text-white text-gray-500 transition-colors"
                                    >
                                      <span className="shrink-0">📄</span>
                                      <span className="text-xs truncate">{cp.name}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${PURPOSE_BADGE[cp.purpose] ?? 'text-gray-500 bg-gray-800 border-gray-700'}`}>
                                        {cp.purpose}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <DetailPanel cp={selected} userName={userName} onClose={() => setSelected(null)} teamCodes={teamCodes} />
      )}
    </div>
  )
}
