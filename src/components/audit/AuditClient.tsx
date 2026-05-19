'use client'

import { useState, useMemo, useCallback } from 'react'
import AuditTimeline from './AuditTimeline'
import SMPanel from '@/components/sm/SMPanel'
import type { AuditEventRow } from '@/lib/db/audit'
import type { CustomProvider } from '@/components/sm/SMPanel'
import type { ProjectWithTeams } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'

const MAX_CONTEXT = 100

interface Props {
  events:          AuditEventRow[]
  customProviders: CustomProvider[]
  checkpoints:     { id: string; name: string }[]
  projects:        ProjectWithTeams[]
}

export default function AuditClient({ events, customProviders, checkpoints, projects }: Props) {
  const [externalDetailCpId, setExternalDetailCpId] = useState<string | null>(null)
  const [filteredEvents,     setFilteredEvents]     = useState<AuditEventRow[]>(events)

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
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <SMPanel
        pageContext={pageContext}
        pageName="Audit Log"
        customProviders={customProviders}
        checkpoints={checkpoints}
        onSelectCheckpoint={(id) => setExternalDetailCpId(id)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-10">
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-white">Event Timeline</h1>
            <p className="text-sm text-gray-500 mt-1">
              {events.length} event{events.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <AuditTimeline
            events={events}
            externalDetailCpId={externalDetailCpId}
            onFilterChange={handleFilterChange}
            teamCodes={teamCodes}
          />
        </div>
      </main>
    </div>
  )
}
