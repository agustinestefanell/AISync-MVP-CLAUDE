'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { DocCheckpoint, DocAuditEvent, DocHandoffPackage } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
import RepositoryView from './RepositoryView'
import StructureView from './StructureView'
import AuditView from './AuditView'
import InvestigateView from './InvestigateView'
import SMPanel from '@/components/sm/SMPanel'
import type { CustomProvider } from '@/components/sm/SMPanel'

const KnowledgeMap = dynamic(() => import('./KnowledgeMap'), { ssr: false })

type Tab = 'repository' | 'structure' | 'audit' | 'investigate' | 'knowledge'

const TABS: { id: Tab; label: string; guide: string }[] = [
  {
    id: 'repository',
    label: 'Repository View',
    guide: `Main operational view. Filterable list of documents by project, team,
type, status, and date. Side detail panel opens on selection.

It is the view for finding things quickly and working with them immediately.
When you enter here, the goal is not deep analysis; the goal is fast access.
You see a clear list of documents, search by name or keyword, filter by
project, team, type, date, or status, and open exactly what you need without
wasting time. In everyday language, it is like the main working table of the
archive. You do not come here to reconstruct the whole story. You come here
to locate the right document, confirm its basic context, and use it. That is
why this should be the main daily-use view.`,
  },
  {
    id: 'structure',
    label: 'Structure View',
    guide: `Hierarchical view focused on organization, provenance, and document
structure across project, team, and workspace.

It is the view for understanding where each thing comes from and how
everything is organized. Here the priority is not speed, but orientation.
You look at the structure of the system: project, team, folder, origin,
hierarchy, and relationship between parts. It helps you understand how
documents are grouped and why they belong where they belong. In simple terms,
it is like looking at the shelves and the archive tree instead of looking at
one document at a time. You use this view when you need to orient yourself,
understand provenance, and see the general order behind the repository.`,
  },
  {
    id: 'audit',
    label: 'Audit View',
    guide: `Document-centric event trace inside Documentation Mode. Shows events
associated with documents and their operational history. Distinct from
the global Audit Log at /audit.

It is the view for reconstructing what happened. You use it to see who
touched something, what was reviewed, what was moved, what was approved,
what was forwarded, and when each step took place. Its purpose is not only
to show that an object exists, but to show the trace of actions around it.
In everyday language, it is like reviewing the movement history of a case
file. This is the right view when you need accountability, chronology, and
operational traceability. It stays closely connected to Audit Log, because
both are part of the same logic of reconstruction.`,
  },
  {
    id: 'investigate',
    label: 'Investigate View',
    guide: `Deep analysis view for studying a topic: related documents, temporal
evolution, and contextual reconstruction.

It is the view for studying a topic in depth. Here you are not looking only
for one specific file, and you are not focused only on structure or chronology.
You are trying to understand a complete matter: which documents are connected,
how something evolved over time, what context existed before and after, and
what pieces belong to the same line of work even if they live in different
places. In simple terms, it is like opening an investigation table around one
issue. It helps you analyze a decision, a client, a problem, or a process as
a whole, not just as isolated documents.`,
  },
  {
    id: 'knowledge',
    label: 'Knowledge Map',
    guide: `Visual graph of relationships between documents and related entities.

It is the view for seeing relationships between things in a visual way. It
is not designed for basic daily work, but for understanding connections that
are harder to detect in a normal list. It helps you see which document comes
from which one, which team participated, which conversation produced which
result, what is linked to what, and where the wider pattern is. In plain
everyday language, it is like a visual map of connections across the archive.
It is useful when you need the wider picture, not just one file. It is a
secondary analytical layer, and it does not replace Repository View.`,
  },
]

const MAX_CONTEXT = 100

interface DocClientProps {
  checkpoints:     DocCheckpoint[]
  handoffPackages: DocHandoffPackage[]
  auditEvents:     DocAuditEvent[]
  projects:        ProjectWithTeams[]
  userName:        string
  userEmail:       string
  customProviders: CustomProvider[]
}

export default function DocClient({ checkpoints, handoffPackages, auditEvents, projects, userName, userEmail, customProviders }: DocClientProps) {
  const [tab,                  setTab]                  = useState<Tab>('repository')
  const [helpTab,              setHelpTab]              = useState<Tab | null>(null)
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null)
  const [filteredCheckpoints,  setFilteredCheckpoints]  = useState<DocCheckpoint[]>(checkpoints)

  function handleSelectCheckpoint(id: string) {
    setTab('repository')
    setSelectedCheckpointId(id)
  }

  const handleFilterChange = useCallback((filtered: DocCheckpoint[]) => {
    setFilteredCheckpoints(filtered)
  }, [])

  const pageContext = useMemo(() => {
    const isFiltered = filteredCheckpoints.length < checkpoints.length
    const total      = filteredCheckpoints.length
    let header: string
    if (isFiltered) {
      header = `DOCUMENTATION MODE — FILTERED CONTEXT (${total} of ${checkpoints.length} total documents)\nActive filters applied. SM searches only within these results.`
    } else {
      header = `DOCUMENTATION MODE — FULL CONTEXT (${checkpoints.length} documents)\nNo filters applied. SM searches all available documents.`
    }
    if (total > MAX_CONTEXT) {
      header += `\nShowing most recent ${MAX_CONTEXT} of ${total} filtered results.`
    }
    const items = filteredCheckpoints.slice(0, MAX_CONTEXT)
    return header + '\n\n' + items.map(c =>
      `- Name: ${c.name} [ID: ${c.id}]\n  Project: ${c.project_name} | Team: ${c.team_name} | Workspace: ${c.workspace_name} | Purpose: ${c.purpose} | State: ${c.doc_state} | Date: ${c.created_at.slice(0, 10)}`
    ).join('\n')
  }, [filteredCheckpoints, checkpoints.length])

  const smCheckpoints = useMemo(() =>
    filteredCheckpoints.slice(0, MAX_CONTEXT).map(c => ({
      id:        c.id,
      name:      c.name,
      team:      c.team_name,
      workspace: c.workspace_name,
      project:   c.project_name,
      date:      c.created_at.slice(0, 10),
      purpose:   c.purpose,
    })),
  [filteredCheckpoints])

  const teamCodes = useMemo(
    () => computeTeamCodes(projects.flatMap(p => p.teams)),
    [projects],
  )

  const helpContent = helpTab ? TABS.find(t => t.id === helpTab) : null

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left: SM Panel */}
      <SMPanel
        pageContext={pageContext}
        pageName="Documentation Mode"
        customProviders={customProviders}
        checkpoints={smCheckpoints}
        onSelectCheckpoint={handleSelectCheckpoint}
      />

      {/* Right: tab bar + view */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="shrink-0 border-b border-gray-800 px-6 flex items-end justify-between">
          {TABS.map(t => (
            <div key={t.id} className="flex flex-col items-center pb-2 gap-1">
              <button
                onClick={() => setTab(t.id)}
                className={`text-xs font-medium px-4 py-3 border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
              <button
                onClick={() => setHelpTab(t.id)}
                className="text-xs text-blue-500 underline cursor-pointer"
              >
                How to use {t.label}
              </button>
            </div>
          ))}
        </div>

        {/* View */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'repository'  && <RepositoryView  checkpoints={checkpoints} handoffPackages={handoffPackages} userName={userName} userEmail={userEmail} externalSelectedId={selectedCheckpointId} onFilterChange={handleFilterChange} teamCodes={teamCodes} />}
          {tab === 'structure'   && <StructureView   checkpoints={checkpoints} projects={projects} userName={userName} userEmail={userEmail} teamCodes={teamCodes} />}
          {tab === 'audit'       && <AuditView        checkpoints={checkpoints} auditEvents={auditEvents} />}
          {tab === 'investigate' && <InvestigateView  checkpoints={checkpoints} projects={projects} userEmail={userEmail} teamCodes={teamCodes} />}
          {tab === 'knowledge'   && <KnowledgeMap     checkpoints={checkpoints} projects={projects} />}
        </div>
      </div>

      {/* Help modal */}
      {helpContent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setHelpTab(null) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-800 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">
                  How to use {helpContent.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setHelpTab(null)}
                className="text-gray-500 hover:text-gray-300 text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {helpContent.guide}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
