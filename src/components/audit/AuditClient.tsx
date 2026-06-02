'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'

const AuditTimeline = dynamic(
  () => import('./AuditTimeline'),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm text-gray-500">Loading calendar...</div>
    ),
  }
)
import SMPanel from '@/components/sm/SMPanel'
import type { AuditEventRow } from '@/lib/db/audit'
import type { CustomProvider } from '@/components/sm/SMPanel'
import type { ProjectWithTeams } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'
import TopRibbon from '@/components/layout/TopRibbon'
import BottomRibbon from '@/components/layout/BottomRibbon'

const AUDIT_GUIDE = `Imagine you are working on something today and suddenly remember that you already saved a useful version of it a few weeks ago. You do not remember the exact session, but you know it was an important point in the process and you want to go back to it instead of starting from scratch. In that case, you go to Audit Log.

Use Audit Log when you want to recover work that was already saved, check the sequence of events, or understand how the work evolved over time. It is especially useful when your question is not What am I doing now? but rather:
What happened before, and where can I continue from?

The main logic is simple. When you use Save Version in the Workspace, AISync creates a checkpoint. That checkpoint later appears in Audit Log. From there, you can open the saved detail, review the history around it, and continue working from that point. Audit Log is therefore the operational bridge between past work and resumed work.

The filters help you narrow down the visible history when the log grows larger. Use them when you know part of the context, but not the exact item. For example, they are useful when you want to find activity from a specific day, locate a checkpoint around a known moment, reduce the visible history to the most relevant items, or understand what happened during a particular time range.

In practical terms, Audit Log helps you move from:
"I know I saved this at some point"
to:
"I found the saved point, I understood when it happened, and I can continue from here."`

const MAX_CONTEXT = 100

interface Props {
  pageName:        string
  events:          AuditEventRow[]
  customProviders: CustomProvider[]
  checkpoints:     { id: string; name: string }[]
  projects:        ProjectWithTeams[]
}

export default function AuditClient({ pageName, events, customProviders, checkpoints, projects }: Props) {
  const [externalDetailCpId, setExternalDetailCpId] = useState<string | null>(null)
  const [filteredEvents,     setFilteredEvents]     = useState<AuditEventRow[]>(events)
  const [showMainGuide,      setShowMainGuide]      = useState(false)

  const teamCodes = useMemo(
    () => computeTeamCodes(projects.flatMap(p => p.teams)),
    [projects],
  )

  const handleFilterChange = useCallback((filtered: AuditEventRow[]) => {
    setFilteredEvents(filtered)
  }, [])

  const pageContext = useMemo(() => {
    const isFiltered = filteredEvents.length < events.length
    const total      = filteredEvents.length
    let header: string
    if (isFiltered) {
      header = `AUDIT LOG — FILTERED CONTEXT (${total} of ${events.length} total events)\nActive filters applied. SM searches only within these results.`
    } else {
      header = `AUDIT LOG — FULL CONTEXT (${events.length} events)\nNo filters applied.`
    }
    if (total > MAX_CONTEXT) {
      header += `\nShowing most recent ${MAX_CONTEXT} of ${total} filtered results.`
    }
    const items = filteredEvents.slice(0, MAX_CONTEXT)
    return header + '\n\n' + items.map(e => {
      const cpName = e.metadata?.name as string | undefined
      return `- Event: ${e.event_type} | Document: ${cpName ?? 'Session event'} | Workspace: ${e.workspaces?.name ?? 'Unknown'} | Date: ${e.created_at.slice(0, 10)}`
    }).join('\n')
  }, [filteredEvents, events.length])

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to use Audit Log"
        pageSubtitleOnClick={() => setShowMainGuide(true)}
      />

      <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <SMPanel
            pageContext={pageContext}
            pageName="Audit Log"
            customProviders={customProviders}
            checkpoints={checkpoints}
            onSelectCheckpoint={(id) => setExternalDetailCpId(id)}
          />
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 pt-4 pb-6">
              <AuditTimeline
                events={events}
                externalDetailCpId={externalDetailCpId}
                onFilterChange={handleFilterChange}
                teamCodes={teamCodes}
              />
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
                  How to use Audit Log
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
                {AUDIT_GUIDE}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
