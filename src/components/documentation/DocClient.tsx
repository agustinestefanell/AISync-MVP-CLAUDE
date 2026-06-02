'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { DocCheckpoint, DocAuditEvent, DocHandoffPackage, DocSavedSelection } from '@/lib/db/documentation'
import type { ProjectWithTeams } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
import RepositoryView from './RepositoryView'
import StructureView from './StructureView'
import AuditView from './AuditView'
import InvestigateView from './InvestigateView'
import SMPanel from '@/components/sm/SMPanel'
import type { CustomProvider } from '@/components/sm/SMPanel'
import TopRibbon from '@/components/layout/TopRibbon'
import BottomRibbon from '@/components/layout/BottomRibbon'

const KnowledgeMap = dynamic(() => import('./KnowledgeMap'), { ssr: false })

type Tab = 'repository' | 'structure' | 'audit' | 'investigate' | 'knowledge'

const TABS: { id: Tab; label: string; guide: string }[] = [
  {
    id: 'repository',
    label: 'Repository View',
    guide: `Imagine you are working on a new deliverable and you need to find something you created two months ago, but you do not remember exactly which team or session it came from. You only remember that it was related to real estate business strategy analysis, that you worked on it in June last year, and that it belonged to Project MK. In that case, you go to Repository View. You search by keyword, narrow the results by project, date, team, or document type, and quickly locate the right document without needing to reconstruct the whole history first.

Repository View is the main working view of Documentation Mode. It is designed for fast access and daily use. This is where you go when you need to find a document quickly, confirm its basic context, and work with it immediately.

Here you can search by name or keyword, filter by project, team, type, status, or date, and open the exact item you need without navigating the full archive structure. When you select a document, the side detail panel helps you confirm what it is, where it belongs, and whether it is the correct item before taking the next step.

Use this view when your question is simple:
Where is the document I need, and can I open it now?

In practical terms, Repository View is like the main working table of the archive. You do not come here to study the full structure, reconstruct the whole timeline, or analyze every relationship between documents. You come here to locate the right item, check its essential context, and use it with minimum friction.

If you are new to Documentation Mode and you are not sure where to start, start here.

If needed, you can always ask the Documentation Mode Sub-Manager to help you find documents using keywords.`,
  },
  {
    id: 'structure',
    label: 'Structure View',
    guide: `Location, orientation, and folder tree.

Use this view to see where things live inside the archive tree.`,
  },
  {
    id: 'audit',
    label: 'Audit View',
    guide: `Imagine you open a document and realize you do not need the document itself first — you need to understand what happened around it. You want to know when it was created, reviewed, moved, approved, or forwarded, and in what order those steps took place. In that case, you go to Audit View.

Audit View is the view for reconstructing what happened around a document. It is not the same as the global Audit Log at /audit. The global Audit Log helps you understand what happened across the system and from where work can be resumed. Audit View, inside Documentation Mode, helps you understand the trace of actions connected to a specific document or documentary object.

Here you use events, chronology, and linked actions to understand the operational history of a document: who touched it, what kind of step took place, when it happened, and how that document moved through the process.

This is the right view when your question is not just What is this? but rather:
What happened to this document over time?

In practical terms, Audit View is like checking the movement history of a case file. You use it when you need accountability, chronology, and operational traceability around a documentary object, not when you simply want to find a file quickly or understand the archive structure.

If needed, you can always ask the Documentation Mode Sub-Manager to help you find documents using keywords.`,
  },
  {
    id: 'investigate',
    label: 'Investigate View',
    guide: `Imagine you are working on a client issue, a strategic decision, or a long process that was developed across different moments, teams, or documents. You are no longer looking for just one file, and you are not only trying to understand structure or trace. You want to understand the whole matter: what belongs to it, how it evolved, what came before and after, and which pieces are part of the same line of work even if they are spread across different places. In that case, you go to Investigate View.

Investigate View is the view for studying a topic in depth. It helps you move from isolated documents to a wider understanding of one issue, one process, one client, one decision, or one evolving body of work.

Here you use related documents, temporal evolution, and contextual reconstruction to understand how a matter developed over time. Instead of asking only Where is the file? or What happened to this document?, you ask:
What is the full story around this topic?

In practical terms, Investigate View is like opening an investigation table around one issue. You use it when you need to connect documents, follow a line of work across time, and understand how different pieces belong to the same matter even if they were produced in different contexts.

This is not the main daily-use view for quick retrieval. It is the view you open when you need depth, context, and a broader reconstruction of meaning.

If needed, you can always ask the Documentation Mode Sub-Manager to help you find documents using keywords.`,
  },
  {
    id: 'knowledge',
    label: 'Knowledge Map',
    guide: `Imagine you are no longer trying to find one document or understand one timeline. Instead, you need to see the wider pattern behind a topic. You want to understand how documents, teams, conversations, outcomes, and related pieces connect to each other across the repository. In that case, you go to Knowledge Map.

Knowledge Map is the visual relationship view of Documentation Mode. It helps you see connections that are harder to detect in a normal list, a structural tree, or a chronological trace. You use it when you need to understand how one piece leads to another, what is linked to what, and where the larger pattern is.

Here you can explore the repository as a graph of connected elements. Instead of asking only Where is this file?, Where does it belong?, or What happened to it?, you ask:
How is this connected to the rest of the system?

In practical terms, Knowledge Map is like looking at the relationship map of the archive. It helps you see which documents are linked, which teams participated, which conversations produced which results, and how different objects relate across the broader documentary base.

This view is currently under development. Full functionality coming soon.

If needed, you can always ask the Documentation Mode Sub-Manager to help you find documents using keywords.`,
  },
]

const MAX_CONTEXT = 100

const MAIN_GUIDE = `Documentation Mode is for moments like these:

→ You worked on something important a few days ago and now you want to find it again, but this time in a more structured environment.
→ You already saved useful material and now you want to explore it beyond the live chat.
→ You are not looking for one message, but for a document, an output, a related piece, or a clearer view of how several things connect.
→ You want to stop thinking in terms of active conversation and start thinking in terms of organized documentation.
→ You need to review past work, understand how pieces belong together, or preserve something in a way that is easier to navigate later.
→ You want to move from "something I worked on before" to "something I can now inspect, understand, and reuse."

This is what Documentation Mode is for: giving structure and visibility to work that would otherwise remain buried inside past conversations.

In practical terms, Documentation Mode is where work stops being just past activity and starts becoming something you can navigate, understand, preserve, and use again later.`

interface DocClientProps {
  pageName:        string
  checkpoints:     DocCheckpoint[]
  handoffPackages: DocHandoffPackage[]
  auditEvents:     DocAuditEvent[]
  projects:        ProjectWithTeams[]
  savedSelections: DocSavedSelection[]
  userName:        string
  userEmail:       string
  customProviders: CustomProvider[]
}

export default function DocClient({ pageName, checkpoints, handoffPackages, auditEvents, projects, savedSelections, userName, userEmail, customProviders }: DocClientProps) {
  const [tab,                  setTab]                  = useState<Tab>('repository')
  const [helpTab,              setHelpTab]              = useState<Tab | null>(null)
  const [showMainGuide,        setShowMainGuide]        = useState(false)
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to use Documentation Mode"
        pageSubtitleOnClick={() => setShowMainGuide(true)}
        userName={userName}
      />

      <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
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
            <div className="shrink-0 border-b border-[var(--color-border-default)] px-6 py-2.5 flex items-center justify-center gap-5">
              {TABS.map(t => (
                <div key={t.id} className="grid min-w-max justify-items-center gap-1">
                  <button
                    onClick={() => setTab(t.id)}
                    className={`h-8 px-3.5 rounded-[10px] text-[0.75rem] font-medium transition-colors border ${
                      tab === t.id
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm'
                        : 'bg-white border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                  <button
                    onClick={() => setHelpTab(t.id)}
                    className="text-[10px] text-[var(--color-text-muted)] underline underline-offset-2 text-center cursor-pointer transition-colors hover:text-[var(--color-accent)]"
                  >
                    How to use {t.label}
                  </button>
                </div>
              ))}
            </div>

            {/* View */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {tab === 'repository'  && <RepositoryView  checkpoints={checkpoints} handoffPackages={handoffPackages} savedSelections={savedSelections} userName={userName} userEmail={userEmail} externalSelectedId={selectedCheckpointId} onFilterChange={handleFilterChange} teamCodes={teamCodes} />}
              {tab === 'structure'   && <StructureView   checkpoints={checkpoints} projects={projects} userName={userName} userEmail={userEmail} teamCodes={teamCodes} />}
              {tab === 'audit'       && <AuditView        checkpoints={checkpoints} auditEvents={auditEvents} teamCodes={teamCodes} />}
              {tab === 'investigate' && <InvestigateView  checkpoints={checkpoints} handoffPackages={handoffPackages} savedSelections={savedSelections} projects={projects} userEmail={userEmail} teamCodes={teamCodes} />}
              {tab === 'knowledge'   && <KnowledgeMap     checkpoints={checkpoints} projects={projects} />}
            </div>
          </div>
        </div>
      </main>

      <BottomRibbon />

      {/* Main guide modal */}
      {showMainGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowMainGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to use Documentation Mode
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setShowMainGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {MAIN_GUIDE}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Per-view help modal */}
      {helpContent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setHelpTab(null) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to use {helpContent.label}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setHelpTab(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {helpContent.guide}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
