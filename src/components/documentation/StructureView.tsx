'use client'

import { useState, useMemo } from 'react'
import type { DocCheckpoint, DocHandoffPackage, DocSavedSelection, DocAuditEvent, DocLoadedContextItem, DocMessageProvenanceItem } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import { type AnchorKind, buildAnchors, anchorMeta, anchorTitle } from '@/lib/documentation/anchors'
import DocumentationMirrorTree from './DocumentationMirrorTree'
import WorkspaceDetailPanel from './WorkspaceDetailPanel'

interface Props {
  checkpoints:              DocCheckpoint[]
  handoffPackages:          DocHandoffPackage[]
  savedSelections:          DocSavedSelection[]
  auditEvents:              DocAuditEvent[]
  contextSourcesWithOrigin: DocLoadedContextItem[]
  messageProvenance:        DocMessageProvenanceItem[]
  projects:                 ProjectWithTeams[]
  userName:                 string
  userEmail:                string
  teamCodes?:               Record<string, string>
}

export default function StructureView({
  checkpoints, handoffPackages, savedSelections, auditEvents, contextSourcesWithOrigin, messageProvenance, projects, teamCodes,
}: Props) {
  // Barra existente — filtra qué nodos Team aparecen en el árbol (oculta,
  // no atenúa). Sin cambios respecto a la OE anterior.
  const [searchQuery,   setSearchQuery]   = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterArchiveStatus, setFilterArchiveStatus] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  // ── Barra nueva (2026-08-20) — los 7 filtros de Repository View sobre los
  // documentos (no sobre qué teams se listan). Project/Team acá NO ocultan
  // ni filtran nada — son navegación: elegir un Team abre/cambia el panel de
  // detalle (mismo `selectedTeamId` que ya dispara el click del árbol), sin
  // duplicar estado. Type/State/Date/Search SÍ filtran de verdad — y ade­más
  // atenúan en el árbol los Teams sin ningún ítem que matchee (ver
  // `dimmedTeamIds` abajo). Decisión de diseño confirmada con Agus — ver
  // handoff-2026-07-b.md 2026-08-20 (Paso 0).
  const [docFilterProject, setDocFilterProject] = useState('')
  const [docFilterType,    setDocFilterType]    = useState<AnchorKind | ''>('')
  const [docFilterState,   setDocFilterState]   = useState('')
  const [docFilterDate,    setDocFilterDate]    = useState('')
  const [docSearchQuery,   setDocSearchQuery]   = useState('')
  const [docSortOrder,     setDocSortOrder]     = useState<'newest' | 'oldest' | 'name'>('newest')

  const allTeams = useMemo(() => projects.flatMap(p => p.teams), [projects])

  // team id → project id lookup (derived from projects, no invented fields)
  const teamProjectMap = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => p.teams.forEach(t => m.set(t.id, p.id)))
    return m
  }, [projects])

  // Team depende de Project en la barra nueva — mismo patrón que las demás
  // vistas — pero acá solo acota las OPCIONES del dropdown de navegación,
  // no filtra el árbol.
  const docTeamOptions = useMemo(() => {
    return allTeams
      .filter(t => !docFilterProject || teamProjectMap.get(t.id) === docFilterProject)
      .map(t => [t.id, t.name] as [string, string])
      .sort(([idA, nameA], [idB, nameB]) => {
        const codeA = teamCodes?.[idA] ?? nameA
        const codeB = teamCodes?.[idB] ?? nameB
        return codeA.localeCompare(codeB)
      })
  }, [allTeams, docFilterProject, teamProjectMap, teamCodes])

  // ── Anclas de toda la cuenta (2026-08-20) — mismos datos ya usados por el
  // panel de detalle, reusados acá también para calcular qué Teams atenuar
  // en el árbol. Sin query nueva — ya viajan completos a DocClient.
  const allAnchors = useMemo(
    () => buildAnchors(checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents),
    [checkpoints, handoffPackages, savedSelections, contextSourcesWithOrigin, messageProvenance, auditEvents],
  )

  // Teams a atenuar (no ocultar) — solo cuando hay algún filtro de
  // contenido activo (Type/State/Date/Search). Project de la barra nueva NO
  // participa acá: ya existe un filtro de Project que OCULTA por completo en
  // la barra existente arriba — repetirlo en la atenuación sería redundante.
  const dimmedTeamIds = useMemo(() => {
    const hasContentFilter = docFilterType || docFilterState || docFilterDate || docSearchQuery
    if (!hasContentFilter) return new Set<string>()
    const q = docSearchQuery.trim().toLowerCase()
    const matchingTeamIds = new Set<string>()
    for (const item of allAnchors) {
      const meta = anchorMeta(item)
      if (!meta.teamId) continue
      if (docFilterType && item.kind !== docFilterType) continue
      if (docFilterState && !(item.kind === 'checkpoint' && item.cp.doc_state === docFilterState)) continue
      if (docFilterDate && !meta.date.startsWith(docFilterDate)) continue
      if (q && !anchorTitle(item).toLowerCase().includes(q)) continue
      matchingTeamIds.add(meta.teamId)
    }
    return new Set(allTeams.filter(t => !matchingTeamIds.has(t.id)).map(t => t.id))
  }, [allAnchors, allTeams, docFilterType, docFilterState, docFilterDate, docSearchQuery])

  const selectedWorkspace = useMemo(() => {
    if (!selectedTeamId) return null
    for (const project of projects) {
      const team = project.teams.find(t => t.id === selectedTeamId)
      if (!team) continue
      const workspace = team.workspaces[0]
      if (!workspace) return null
      return {
        workspaceId:   workspace.id,
        workspaceName: workspace.name,
        teamId:        team.id,
        teamName:      team.name,
        projectId:     project.id,
        projectName:   project.name,
      }
    }
    return null
  }, [selectedTeamId, projects])

  // Anclas del Workspace elegido, ya filtradas (Type/State/Date/Search) y
  // ordenadas (Sort) con los mismos 4 controles que atenúan el árbol — el
  // panel es puramente presentacional, no tiene filtro propio.
  const selectedWorkspaceAnchors = useMemo(() => {
    if (!selectedWorkspace) return []
    const q = docSearchQuery.trim().toLowerCase()
    const filtered = allAnchors.filter(item => {
      if (anchorMeta(item).wsId !== selectedWorkspace.workspaceId) return false
      if (docFilterType && item.kind !== docFilterType) return false
      if (docFilterState && !(item.kind === 'checkpoint' && item.cp.doc_state === docFilterState)) return false
      if (docFilterDate && !anchorMeta(item).date.startsWith(docFilterDate)) return false
      if (q && !anchorTitle(item).toLowerCase().includes(q)) return false
      return true
    })
    return [...filtered].sort((a, b) => {
      if (docSortOrder === 'name') return anchorTitle(a).localeCompare(anchorTitle(b))
      const dateA = anchorMeta(a).date
      const dateB = anchorMeta(b).date
      return docSortOrder === 'oldest' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    })
  }, [allAnchors, selectedWorkspace, docFilterType, docFilterState, docFilterDate, docSearchQuery, docSortOrder])

  const mirrorTeams = useMemo(
    () => allTeams.map(t => {
      const code = teamCodes?.[t.id]
      return { teamId: t.id, teamLabel: code ? `${code} · ${t.name}` : t.name, teamStatus: t.status }
    }),
    [allTeams, teamCodes],
  )

  const mirrorAgents = useMemo(
    () => allTeams.flatMap(team => {
      const workspace = team.workspaces[0]
      if (!workspace) return []
      const code = teamCodes?.[team.id]
      const managerSession = workspace.agent_sessions.find(s => s.agent_role === 'manager')
      return workspace.agent_sessions.map(session => {
        const isManager  = session.agent_role === 'manager'
        const isSubMgr   = isManager && team.parent_id !== null
        const roleLabel  = isManager ? (isSubMgr ? 'Sub-Manager' : 'Manager') : 'Worker'
        const agentLabel = code ? `${code} · ${roleLabel}` : roleLabel
        return {
          unitId:           session.id,
          treeParentUnitId: !isManager && managerSession ? managerSession.id : null,
          teamId:           team.id,
          agentLabel,
          agentRole: isManager
            ? (team.parent_id === null ? 'general_manager' : 'senior_manager')
            : 'worker',
          historical: false,
        }
      })
    }),
    [allTeams, teamCodes],
  )

  const filteredMirrorTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return mirrorTeams.filter(team => {
      if (filterProject && teamProjectMap.get(team.teamId) !== filterProject) return false
      if (filterArchiveStatus && team.teamStatus !== filterArchiveStatus) return false
      if (q && !team.teamLabel.toLowerCase().includes(q)) return false
      return true
    })
  }, [mirrorTeams, searchQuery, filterProject, filterArchiveStatus, teamProjectMap])

  const filteredTeamIds = useMemo(
    () => new Set(filteredMirrorTeams.map(t => t.teamId)),
    [filteredMirrorTeams],
  )

  const filteredMirrorAgents = useMemo(
    () => mirrorAgents.filter(agent => filteredTeamIds.has(agent.teamId)),
    [mirrorAgents, filteredTeamIds],
  )

  const rootLabel = projects[0]?.name ?? 'Documentation'

  const hasDocFilter = docFilterProject || selectedTeamId || docFilterType || docFilterState || docFilterDate || docSearchQuery
  function resetDocFilters() {
    setDocFilterProject(''); setDocFilterType(''); setDocFilterState('')
    setDocFilterDate(''); setDocSearchQuery('')
  }

  if (mirrorTeams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-[var(--color-text-secondary)] text-sm">No teams configured yet.</p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            Add teams with workspaces to see the structure.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Barra existente — qué Teams aparecen en el árbol */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border-default)] flex flex-wrap gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search teams or agents..."
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[200px]"
        />
        {projects.length > 1 && (
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterArchiveStatus}
          onChange={e => setFilterArchiveStatus(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All team statuses</option>
          <option value="active">Active teams</option>
          <option value="archived">Archived teams</option>
        </select>
        {(searchQuery || filterProject || filterArchiveStatus) && (
          <button
            onClick={() => { setSearchQuery(''); setFilterProject(''); setFilterArchiveStatus('') }}
            className="text-xs text-gray-500 hover:text-gray-600 px-2"
          >
            Reset Search
          </button>
        )}
      </div>

      {/* Barra nueva — filtra/navega documentos (Type/State/Date/Search
          atenúan Teams sin match; Project/Team navegan al panel) */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
        <select value={docFilterProject} onChange={e => setDocFilterProject(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedTeamId ?? ''} onChange={e => setSelectedTeamId(e.target.value || null)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">Go to team...</option>
          {docTeamOptions.map(([id, name]) => <option key={id} value={id}>{teamCodes?.[id] ? `${teamCodes[id]} · ${name}` : name}</option>)}
        </select>
        <select value={docFilterType} onChange={e => setDocFilterType(e.target.value as AnchorKind | '')}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All anchor types (5)</option>
          <option value="checkpoint">Checkpoint</option>
          <option value="handoff">Handoff Package</option>
          <option value="saved_selection">Saved Selection</option>
          <option value="loaded_context">Loaded Context</option>
          <option value="review_forward">Review &amp; Forward</option>
        </select>
        <select value={docFilterState} onChange={e => setDocFilterState(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
        </select>
        <input type="date" value={docFilterDate} onChange={e => setDocFilterDate(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500" />
        <input
          type="text"
          placeholder="Search documents..."
          value={docSearchQuery}
          onChange={e => setDocSearchQuery(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500 min-w-[160px]"
        />
        <select value={docSortOrder} onChange={e => setDocSortOrder(e.target.value as typeof docSortOrder)}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
        {hasDocFilter && (
          <button
            onClick={() => { resetDocFilters(); setSelectedTeamId(null) }}
            className="text-xs text-gray-500 hover:text-gray-600 px-2"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tree (+ panel de detalle por Workspace al seleccionar un Team) or filtered empty state */}
      {filteredMirrorTeams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[var(--color-text-muted)] text-sm">No teams match your search.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className={`min-h-0 ${selectedWorkspace ? 'w-1/2 border-r border-[var(--color-border-subtle)]' : 'flex-1'}`}>
            <DocumentationMirrorTree
              rootLabel={rootLabel}
              teams={filteredMirrorTeams}
              agents={filteredMirrorAgents}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              dimmedTeamIds={dimmedTeamIds}
            />
          </div>
          {selectedWorkspace && (
            <WorkspaceDetailPanel
              workspaceId={selectedWorkspace.workspaceId}
              workspaceName={selectedWorkspace.workspaceName}
              teamId={selectedWorkspace.teamId}
              teamName={selectedWorkspace.teamName}
              projectName={selectedWorkspace.projectName}
              anchors={selectedWorkspaceAnchors}
              teamCodes={teamCodes}
              onClose={() => setSelectedTeamId(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
