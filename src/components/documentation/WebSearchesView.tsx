'use client'

// Pestaña "Web Searches" de Documentation Mode (OE Trazabilidad, Parte 2 —
// 2026-09-29). Solo lectura: cada búsqueda web del agente con su estado, sus
// fuentes (cuáles citó la respuesta) y un fragmento de esa respuesta. Datos
// cargados al abrir la pestaña (/api/documentation/web-searches).

import { useEffect, useMemo, useState } from 'react'
import type { ProjectWithTeams } from '@/lib/db/types'
import type { DocWebSearch, WebSearchLinkState } from '@/lib/db/documentation-trace'
import {
  FILTER_CLASS, formatExact, agentLabel, locationLine, teamOptions, projectOptions,
  StatCard, DetailRow, Badge, SectionTitle, ResponseSnippet, OpenInWorkspace, LoadState,
} from './TraceShared'

type StatusFilter = '' | 'cited' | 'not_cited' | 'interrupted' | 'failed' | 'legacy'

// Estado a mostrar — una sola etiqueta por búsqueda.
function statusOf(s: DocWebSearch): { key: StatusFilter; label: string; className: string } {
  const byState: Record<WebSearchLinkState, () => { key: StatusFilter; label: string; className: string }> = {
    failed:      () => ({ key: 'failed',      label: 'Search failed',                    className: 'text-red-700 bg-red-50 border-red-200' }),
    interrupted: () => ({ key: 'interrupted', label: 'Response not saved (interrupted)', className: 'text-amber-700 bg-amber-50 border-amber-200' }),
    legacy:      () => ({ key: 'legacy',      label: 'Recorded before linking',          className: 'text-gray-600 bg-gray-50 border-gray-200' }),
    linked:      () => !s.cited_evaluated
      ? { key: 'not_cited', label: 'Citations not evaluated', className: 'text-gray-600 bg-gray-50 border-gray-200' }
      : s.cited_count > 0
        ? { key: 'cited',     label: `Cited ${s.cited_count} of ${s.sources.length} sources`, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
        : { key: 'not_cited', label: 'No sources cited',                                       className: 'text-orange-700 bg-orange-50 border-orange-200' },
  }
  return byState[s.link_state]()
}

function emptyResponseText(s: DocWebSearch): string {
  if (s.link_state === 'interrupted') return 'This search ran, but the response was never saved — its results were not used in any saved answer.'
  if (s.link_state === 'legacy')      return 'No agent response found for this search (recorded before searches were linked to responses).'
  if (s.link_state === 'failed')      return 'The search failed and no agent response was saved for this turn.'
  return 'The response linked to this search is no longer available.'
}

interface Props {
  projects:   ProjectWithTeams[]
  teamCodes?: Record<string, string>
}

export default function WebSearchesView({ projects, teamCodes }: Props) {
  const [searches, setSearches] = useState<DocWebSearch[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [query,          setQuery]          = useState('')
  const [filterProject,  setFilterProject]  = useState('')
  const [filterTeam,     setFilterTeam]     = useState('')
  const [filterDate,     setFilterDate]     = useState('')
  const [filterStatus,   setFilterStatus]   = useState<StatusFilter>('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterAgent,    setFilterAgent]    = useState('')
  const [sortOrder,      setSortOrder]      = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    let cancelled = false
    fetch('/api/documentation/web-searches')
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Could not load web searches.')
        if (!cancelled) setSearches(body.searches ?? [])
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load web searches.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const teams     = useMemo(() => teamOptions(searches, filterProject, teamCodes), [searches, filterProject, teamCodes])
  const providers = useMemo(() => Array.from(new Set(searches.map(s => s.provider).filter((p): p is string => Boolean(p)))).sort(), [searches])
  const agents    = useMemo(() => Array.from(new Set(searches.map(s => s.agent_role).filter((a): a is string => Boolean(a)))).sort(), [searches])

  useEffect(() => {
    if (filterTeam && !teams.some(([id]) => id === filterTeam)) setFilterTeam('')
  }, [filterTeam, teams])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searches
      .filter(s => {
        if (filterProject  && s.project_id !== filterProject) return false
        if (filterTeam     && s.team_id    !== filterTeam)    return false
        if (filterDate     && !s.created_at.startsWith(filterDate)) return false
        if (filterStatus   && statusOf(s).key !== filterStatus) return false
        if (filterProvider && s.provider   !== filterProvider) return false
        if (filterAgent    && s.agent_role !== filterAgent)    return false
        if (q) {
          const haystack = [s.query, ...s.sources.flatMap(src => [src.title, src.domain])].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => sortOrder === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [searches, query, filterProject, filterTeam, filterDate, filterStatus, filterProvider, filterAgent, sortOrder])

  const selected = selectedId ? searches.find(s => s.id === selectedId) ?? null : null
  const hasFilter = query || filterProject || filterTeam || filterDate || filterStatus || filterProvider || filterAgent

  function resetFilters() {
    setQuery(''); setFilterProject(''); setFilterTeam(''); setFilterDate('')
    setFilterStatus(''); setFilterProvider(''); setFilterAgent(''); setSortOrder('newest')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Results"     value={filtered.length} />
        <StatCard label="Cited"       value={searches.filter(s => statusOf(s).key === 'cited').length} />
        <StatCard label="Interrupted" value={searches.filter(s => s.link_state === 'interrupted').length} />
        <StatCard label="Failed"      value={searches.filter(s => s.link_state === 'failed').length} />
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className={`flex flex-col min-h-0 ${selected ? 'w-1/2' : 'flex-1'} min-w-0 border-r border-[var(--color-border-subtle)]`}>
          <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search by topic, query or source domain..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={`${FILTER_CLASS} min-w-[260px]`}
            />
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={FILTER_CLASS}>
              <option value="">All projects</option>
              {projectOptions(projects).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={FILTER_CLASS}>
              <option value="">All teams</option>
              {teams.map(([id, name]) => <option key={id} value={id}>{teamCodes?.[id] ? `${teamCodes[id]} · ${name}` : name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} className={FILTER_CLASS}>
              <option value="">All statuses</option>
              <option value="cited">Cited sources</option>
              <option value="not_cited">No sources cited</option>
              <option value="interrupted">Interrupted (response not saved)</option>
              <option value="failed">Failed</option>
              <option value="legacy">Recorded before linking</option>
            </select>
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className={FILTER_CLASS}>
              <option value="">All providers</option>
              {providers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className={FILTER_CLASS}>
              <option value="">All agents</option>
              {agents.map(a => <option key={a} value={a}>{agentLabel(a)}</option>)}
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className={FILTER_CLASS} />
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)} className={FILTER_CLASS}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            {hasFilter && <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-600 px-2">Reset</button>}
          </div>

          <div className="flex-1 overflow-y-auto">
            <LoadState
              loading={loading}
              error={error}
              empty={!loading && !error && filtered.length === 0}
              emptyText={searches.length === 0 ? 'No web searches yet. Turn on Web search in a Workspace chat to see them here.' : 'No results. Try different filters or search terms.'}
            />
            {!loading && !error && filtered.length > 0 && (
              <div className="p-4 grid gap-3 content-start">
                {filtered.map(s => {
                  const isActive = selectedId === s.id
                  const status = statusOf(s)
                  return (
                    <article
                      key={s.id}
                      onClick={() => setSelectedId(isActive ? null : s.id)}
                      className={`rounded-[14px] border overflow-hidden cursor-pointer transition-colors px-4 py-3 ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                          : 'bg-[var(--color-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug min-w-0">&ldquo;{s.query || '—'}&rdquo;</p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          <Badge className={status.className}>{status.label}</Badge>
                          <Badge className="text-sky-700 bg-sky-50 border-sky-200">Web Search</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">{locationLine(s, teamCodes)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]" suppressHydrationWarning>
                        {agentLabel(s.agent_role)} · {s.provider ?? '—'}{s.model ? ` ${s.model}` : ''} · {formatExact(s.created_at)}
                      </p>
                      {s.response_snippet ? (
                        <p className="mt-2 text-xs text-[var(--color-text-secondary)] line-clamp-2">{s.response_snippet}</p>
                      ) : s.link_state === 'interrupted' ? (
                        <p className="mt-2 text-xs text-amber-700">Results were not used — the response was never saved.</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selected ? (
          <div className="w-1/2 min-w-0 overflow-hidden">
            <WebSearchDetail search={selected} teamCodes={teamCodes} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-[var(--color-text-muted)] text-sm">
            Select a web search to view details
          </div>
        )}
      </div>
    </div>
  )
}

function WebSearchDetail({ search: s, teamCodes, onClose }: { search: DocWebSearch; teamCodes?: Record<string, string>; onClose: () => void }) {
  const status = statusOf(s)
  const sources = [...s.sources].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  return (
    <div className="h-full min-h-0 flex flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">&ldquo;{s.query || '—'}&rdquo;</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{locationLine(s, teamCodes)}</p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        <div className="space-y-2.5">
          <DetailRow label="Status"><Badge className={status.className}>{status.label}</Badge></DetailRow>
          {s.link_state === 'failed' && s.error && <DetailRow label="Error">{s.error}</DetailRow>}
          <DetailRow label="Searched at">{formatExact(s.created_at)}</DetailRow>
          <DetailRow label="Agent">{agentLabel(s.agent_role)}</DetailRow>
          <DetailRow label="Provider / model">{s.provider ?? '—'}{s.model ? ` · ${s.model}` : ''}</DetailRow>
          <DetailRow label="Project">{s.project_name ?? '—'}</DetailRow>
          <DetailRow label="Team">{s.team_name ?? '—'}</DetailRow>
          <DetailRow label="Workspace">{s.workspace_name}</DetailRow>
        </div>

        <ResponseSnippet
          snippet={s.response_snippet}
          at={s.response_at}
          note={s.response_match === 'by_time' ? 'Matched by time (recorded before linking)' : undefined}
          empty={emptyResponseText(s)}
        />

        <div>
          <SectionTitle>Sources returned ({sources.length})</SectionTitle>
          {sources.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No sources were returned.</p>
          ) : (
            <ol className="space-y-2">
              {sources.map(src => (
                <li key={`${src.position}-${src.url}`} className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border-default)] px-3 py-2">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)] w-5 shrink-0 pt-0.5">#{src.position ?? '—'}</span>
                  <div className="min-w-0 flex-1">
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-700 hover:underline break-words">
                      {src.title}
                    </a>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      {src.domain}{src.published_date ? ` · published ${src.published_date}` : ''}
                    </p>
                  </div>
                  {src.cited && <Badge className="text-emerald-700 bg-emerald-50 border-emerald-200">✓ Cited</Badge>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
            Only sources whose link appears in the saved response count as cited — a source mentioned by name only is not detected.
          </p>
        </div>

        <OpenInWorkspace workspaceId={s.workspace_id} at={s.created_at} agentRole={s.agent_role} />
      </div>
    </div>
  )
}
