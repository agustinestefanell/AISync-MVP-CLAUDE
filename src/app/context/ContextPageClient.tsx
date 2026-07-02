'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopRibbon from '@/components/layout/TopRibbon'
import BottomRibbon from '@/components/layout/BottomRibbon'

const CONTEXT_GUIDE = `Context Files is where you manage the documents and files that your AI agents can read before responding.

When you upload a file to a scope, every agent operating within that scope has access to its content as background material. The scope hierarchy works as follows:

Project context is available to all agents across every team in the project. Use it for foundational documents that apply broadly — architecture decisions, product briefs, company policies.

Team context is available to all agents assigned to a specific team. Use it for team-specific references — working agreements, sprint goals, domain glossaries.

Session context is available only within a specific agent session. Use it for task-specific material — a document draft, a data extract, a reference you only need for this conversation.

To add a file, open a Workspace and use the Context Files panel inside any agent session. Files appear here once uploaded. Use Archive to remove a file from active use without deleting it permanently.`

interface ContextSource {
  id:                       string
  title:                    string
  scope:                    'project' | 'team' | 'session' | null
  source_kind:              string | null
  file_type:                string | null
  file_size_bytes:          number | null
  extracted_text_available: boolean
  notes:                    string | null
  status:                   string
  created_at:               string
  project_id:               string | null
  team_id:                  string | null
  session_id:               string | null
  // Resolved fields (from fallback queries)
  projectName?:             string | null
  teamName?:                string | null
  agentRole?:               string | null
  agentProvider?:           string | null
}

interface Props {
  pageName: string
  userId:   string
}

export default function ContextPageClient({ pageName, userId }: Props) {
  const supabase = createClient()
  const [sources,   setSources]   = useState<ContextSource[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Step 1: Fetch context_sources with acotado SELECT (all statuses)
      const { data, error: err } = await supabase
        .from('context_sources')
        .select('id,title,scope,source_kind,file_type,file_size_bytes,extracted_text_available,notes,status,created_at,project_id,team_id,session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (err) throw err

      const rawSources = (data ?? []) as ContextSource[]

      // Step 2: Collect distinct IDs for each type
      const projectIds = Array.from(new Set(rawSources.map(s => s.project_id).filter(Boolean))) as string[]
      const teamIds    = Array.from(new Set(rawSources.map(s => s.team_id).filter(Boolean))) as string[]
      const sessionIds = Array.from(new Set(rawSources.map(s => s.session_id).filter(Boolean))) as string[]

      // Step 3: Fetch related data with acotado SELECTs
      const [projectsRes, teamsRes, sessionsRes] = await Promise.all([
        projectIds.length > 0
          ? supabase.from('projects').select('id,name').in('id', projectIds)
          : Promise.resolve({ data: [] }),
        teamIds.length > 0
          ? supabase.from('teams').select('id,name').in('id', teamIds)
          : Promise.resolve({ data: [] }),
        sessionIds.length > 0
          ? supabase.from('agent_sessions').select('id,agent_role,provider').in('id', sessionIds)
          : Promise.resolve({ data: [] })
      ])

      // Step 4: Build Maps for O(1) lookup
      const projectMap = new Map((projectsRes.data ?? []).map(p => [p.id, p.name]))
      const teamMap    = new Map((teamsRes.data ?? []).map(t => [t.id, t.name]))
      const sessionMap = new Map((sessionsRes.data ?? []).map(s => [s.id, { agent_role: s.agent_role, provider: s.provider }]))

      // Step 5: Enrich sources with resolved names
      const enriched = rawSources.map(s => {
        const session = s.session_id ? sessionMap.get(s.session_id) : null
        return {
          ...s,
          projectName:   s.project_id ? projectMap.get(s.project_id) ?? null : null,
          teamName:      s.team_id ? teamMap.get(s.team_id) ?? null : null,
          agentRole:     session?.agent_role ?? null,
          agentProvider: session?.provider ?? null,
        }
      })

      setSources(enriched)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading context sources')
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => { load() }, [load])

  async function archive(id: string) {
    setArchiving(id)
    try {
      const { error: err } = await supabase
        .from('context_sources')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (err) throw err
      setSources(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed')
    } finally {
      setArchiving(null)
    }
  }

  // Filter for status (default: active only)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Build dynamic status options from real data
  const distinctStatuses = Array.from(new Set(sources.map(s => s.status).filter(Boolean)))
    .sort()

  // Apply filter in memory
  const filteredSources = statusFilter === 'all'
    ? sources
    : sources.filter(s => s.status === statusFilter)

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to use Context Files"
        pageSubtitleOnClick={() => setShowGuide(true)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {error && (
            <div className="mb-6 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <>
              {/* Status filter */}
              <div className="mb-6 flex items-center gap-3">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Status:</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-xs border border-[var(--color-border-default)] rounded px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  {distinctStatuses.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                  <option value="all">All</option>
                </select>
              </div>

              {/* Unified table */}
              <UnifiedContextTable
                sources={filteredSources}
                archiving={archiving}
                onArchive={archive}
              />
            </>
          )}
        </div>
      </main>

      <BottomRibbon />

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to use Context Files
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {CONTEXT_GUIDE}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UnifiedContextTable({
  sources, archiving, onArchive,
}: {
  sources:   ContextSource[]
  archiving: string | null
  onArchive: (id: string) => void
}) {
  function getScopeLabel(scope: string | null | undefined) {
    if (!scope) return '—'
    const labels: Record<string, string> = {
      project: 'Project',
      team:    'Team',
      session: 'Session',
    }
    return labels[scope] ?? (scope.charAt(0).toUpperCase() + scope.slice(1))
  }

  function getAgentRoleLabel(role: string | null | undefined) {
    if (!role) return null
    const labels: Record<string, string> = {
      manager: 'Manager',
      worker1: 'Worker 1',
      worker2: 'Worker 2',
    }
    return labels[role] ?? role
  }

  if (sources.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] italic">No files match the current filter.</p>
    )
  }

  return (
    <div className="border border-[var(--color-border-default)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-[var(--color-border-default)] text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
        <div>File Name</div>
        <div>Type</div>
        <div>Size</div>
        <div>Team Location</div>
        <div>Project</div>
        <div>Agent</div>
        <div>Scope</div>
        <div>Status</div>
        <div>Actions</div>
      </div>

      {/* Table rows */}
      {sources.map((s, i) => {
        const agentLabel = s.agentRole && s.agentProvider
          ? `${getAgentRoleLabel(s.agentRole)} (${s.agentProvider})`
          : null

        return (
          <div
            key={s.id}
            className={`grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 ${
              i < sources.length - 1 ? 'border-b border-[var(--color-border-default)]' : ''
            }`}
          >
            {/* File Name */}
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-text-primary)] truncate">{s.title}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 space-x-1">
                {s.extracted_text_available ? (
                  <span className="text-emerald-600">text extracted</span>
                ) : (
                  <span>no text</span>
                )}
                {s.notes && <> · {s.notes}</>}
              </p>
            </div>

            {/* Type */}
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {s.file_type?.split('/').pop() ?? s.source_kind ?? '—'}
            </div>

            {/* Size */}
            <div className="text-xs text-[var(--color-text-secondary)]">
              {s.file_size_bytes != null ? `${(s.file_size_bytes / 1024).toFixed(1)} KB` : '—'}
            </div>

            {/* Team Location */}
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {s.scope === 'project' ? '—' : s.teamName ?? '—'}
            </div>

            {/* Project */}
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {s.projectName ?? '—'}
            </div>

            {/* Agent */}
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {s.scope === 'session' ? agentLabel ?? '—' : '—'}
            </div>

            {/* Scope */}
            <div>
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700">
                {getScopeLabel(s.scope)}
              </span>
            </div>

            {/* Status */}
            <div className="text-xs text-[var(--color-text-secondary)] capitalize">
              {s.status ?? '—'}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end">
              <button
                onClick={() => onArchive(s.id)}
                disabled={archiving === s.id}
                className="text-[11px] text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-50 transition-colors px-2 py-1 rounded hover:bg-red-50"
              >
                {archiving === s.id ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
