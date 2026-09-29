'use client'

// Pestaña "Attached Files" de Documentation Mode (OE Trazabilidad, Parte 2 —
// 2026-09-29). Solo lectura: cada archivo adjuntado en un chat con su
// metadata (el contenido nunca se guarda) y un fragmento de la respuesta del
// agente a ese mensaje. Datos cargados al abrir la pestaña
// (/api/documentation/attached-files). Los duplicados pre-Parte 1 llegan ya
// agrupados como "Legacy record" (decisión B de Agus).

import { useEffect, useMemo, useState } from 'react'
import type { ProjectWithTeams } from '@/lib/db/types'
import type { DocAttachedFile } from '@/lib/db/documentation-trace'
import {
  FILTER_CLASS, formatExact, formatBytes, agentLabel, locationLine, teamOptions, projectOptions,
  StatCard, DetailRow, Badge, ResponseSnippet, OpenInWorkspace, LoadState,
} from './TraceShared'

const TYPE_BADGE: Record<DocAttachedFile['attachment_type'], string> = {
  image:    'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
  document: 'text-indigo-700 bg-indigo-50 border-indigo-200',
}

const NO_RESPONSE_TEXT = 'No agent response was saved for the message this file was sent with.'

interface Props {
  projects:   ProjectWithTeams[]
  teamCodes?: Record<string, string>
}

export default function AttachedFilesView({ projects, teamCodes }: Props) {
  const [files,   setFiles]   = useState<DocAttachedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [query,           setQuery]           = useState('')
  const [filterProject,   setFilterProject]   = useState('')
  const [filterTeam,      setFilterTeam]      = useState('')
  const [filterDate,      setFilterDate]      = useState('')
  const [filterType,      setFilterType]      = useState<'' | 'image' | 'document'>('')
  const [filterExtension, setFilterExtension] = useState('')
  const [sortOrder,       setSortOrder]       = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    let cancelled = false
    fetch('/api/documentation/attached-files')
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Could not load attached files.')
        if (!cancelled) setFiles(body.files ?? [])
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load attached files.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const teams      = useMemo(() => teamOptions(files, filterProject, teamCodes), [files, filterProject, teamCodes])
  const extensions = useMemo(() => Array.from(new Set(files.map(f => f.extension).filter(Boolean))).sort(), [files])

  useEffect(() => {
    if (filterTeam && !teams.some(([id]) => id === filterTeam)) setFilterTeam('')
  }, [filterTeam, teams])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return files
      .filter(f => {
        if (filterProject   && f.project_id      !== filterProject)   return false
        if (filterTeam      && f.team_id         !== filterTeam)      return false
        if (filterDate      && !f.created_at.startsWith(filterDate))  return false
        if (filterType      && f.attachment_type !== filterType)      return false
        if (filterExtension && f.extension       !== filterExtension) return false
        if (q && !`${f.filename} ${f.extension}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => sortOrder === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  }, [files, query, filterProject, filterTeam, filterDate, filterType, filterExtension, sortOrder])

  const selected  = selectedId ? files.find(f => f.id === selectedId) ?? null : null
  const hasFilter = query || filterProject || filterTeam || filterDate || filterType || filterExtension
  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0)

  function resetFilters() {
    setQuery(''); setFilterProject(''); setFilterTeam(''); setFilterDate('')
    setFilterType(''); setFilterExtension(''); setSortOrder('newest')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-6 py-4 grid grid-cols-4 gap-3 border-b border-[var(--color-border-default)]">
        <StatCard label="Results"         value={filtered.length} />
        <StatCard label="Images"          value={files.filter(f => f.attachment_type === 'image').length} />
        <StatCard label="Documents"       value={files.filter(f => f.attachment_type === 'document').length} />
        <StatCard label="Total size"      value={formatBytes(totalSize)} />
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className={`flex flex-col min-h-0 ${selected ? 'w-1/2' : 'flex-1'} min-w-0 border-r border-[var(--color-border-subtle)]`}>
          <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search by file name or extension..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={`${FILTER_CLASS} min-w-[240px]`}
            />
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={FILTER_CLASS}>
              <option value="">All projects</option>
              {projectOptions(projects).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={FILTER_CLASS}>
              <option value="">All teams</option>
              {teams.map(([id, name]) => <option key={id} value={id}>{teamCodes?.[id] ? `${teamCodes[id]} · ${name}` : name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)} className={FILTER_CLASS}>
              <option value="">All file types</option>
              <option value="image">Images</option>
              <option value="document">Documents</option>
            </select>
            <select value={filterExtension} onChange={e => setFilterExtension(e.target.value)} className={FILTER_CLASS}>
              <option value="">All extensions</option>
              {extensions.map(ext => <option key={ext} value={ext}>.{ext}</option>)}
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
              emptyText={files.length === 0 ? 'No attached files yet. Files you attach in a Workspace chat will appear here.' : 'No results. Try different filters or search terms.'}
            />
            {!loading && !error && filtered.length > 0 && (
              <div className="p-4 grid gap-3 content-start">
                {filtered.map(f => {
                  const isActive = selectedId === f.id
                  return (
                    <article
                      key={f.id}
                      onClick={() => setSelectedId(isActive ? null : f.id)}
                      className={`rounded-[14px] border overflow-hidden cursor-pointer transition-colors px-4 py-3 ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                          : 'bg-[var(--color-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug min-w-0 break-words">{f.filename}</p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {f.is_legacy && <Badge className="text-gray-600 bg-gray-50 border-gray-200">Legacy record</Badge>}
                          <Badge className={TYPE_BADGE[f.attachment_type]}>{f.extension ? `.${f.extension}` : f.attachment_type}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">{locationLine(f, teamCodes)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]" suppressHydrationWarning>
                        {agentLabel(f.agent_role)} · {formatBytes(f.size_bytes)} · {formatExact(f.created_at)}
                      </p>
                      {f.response_snippet && (
                        <p className="mt-2 text-xs text-[var(--color-text-secondary)] line-clamp-2">{f.response_snippet}</p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selected ? (
          <div className="w-1/2 min-w-0 overflow-hidden">
            <AttachedFileDetail file={selected} teamCodes={teamCodes} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-[var(--color-text-muted)] text-sm">
            Select a file to view details
          </div>
        )}
      </div>
    </div>
  )
}

function AttachedFileDetail({ file: f, teamCodes, onClose }: { file: DocAttachedFile; teamCodes?: Record<string, string>; onClose: () => void }) {
  return (
    <div className="h-full min-h-0 flex flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight break-words">{f.filename}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{locationLine(f, teamCodes)}</p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3">
          File content is not stored — metadata only.
        </p>

        <div className="space-y-2.5">
          <DetailRow label="Extension">{f.extension ? `.${f.extension}` : '—'}</DetailRow>
          <DetailRow label="Type">{f.attachment_type === 'image' ? 'Image' : 'Document'} · {f.mime_type}</DetailRow>
          <DetailRow label="Size">{formatBytes(f.size_bytes)}</DetailRow>
          <DetailRow label="Attached at">{formatExact(f.created_at)}</DetailRow>
          <DetailRow label="Agent">{agentLabel(f.agent_role)}</DetailRow>
          <DetailRow label="Sent to">{f.provider ?? '—'}</DetailRow>
          <DetailRow label="Project">{f.project_name ?? '—'}</DetailRow>
          <DetailRow label="Team">{f.team_name ?? '—'}</DetailRow>
          <DetailRow label="Workspace">{f.workspace_name}</DetailRow>
          {f.is_legacy && (
            <DetailRow label="Record">
              Legacy record — attached before files were linked to messages
              {f.legacy_rows > 1 ? ` (${f.legacy_rows} duplicate entries grouped into one; earliest shown)` : ''}.
            </DetailRow>
          )}
        </div>

        <ResponseSnippet
          snippet={f.response_snippet}
          at={f.response_at}
          note="Next agent response after the file was sent"
          empty={NO_RESPONSE_TEXT}
        />

        <OpenInWorkspace workspaceId={f.workspace_id} at={f.created_at} agentRole={f.agent_role} />
      </div>
    </div>
  )
}
