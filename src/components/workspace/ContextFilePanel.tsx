'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ContextSource {
  id:                       string
  title:                    string
  scope:                    'project' | 'team' | 'session' | null
  source_kind:              string | null
  file_type:                string | null
  file_size_bytes:          number | null
  extracted_text_available: boolean
  notes:                    string | null
  created_at:               string
}

interface Props {
  open:         boolean
  onClose:      () => void
  projectId?:   string
  teamId?:      string
  workspaceId?: string
  sessionId?:   string
  userId?:      string
}

export default function ContextFilePanel({
  open, onClose, projectId, teamId, workspaceId, sessionId,
}: Props) {
  const supabase = createClient()

  const [sessionSources, setSessionSources] = useState<ContextSource[]>([])
  const [teamSources,    setTeamSources]    = useState<ContextSource[]>([])
  const [projectSources, setProjectSources] = useState<ContextSource[]>([])
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  // Upload form state
  const [file,        setFile]        = useState<File | null>(null)
  const [formNotes,   setFormNotes]   = useState('')
  const [scope,       setScope]       = useState<'team' | 'project' | 'session'>('team')
  const [uploading,   setUploading]   = useState(false)
  const [uploadDone,  setUploadDone]  = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      loadActiveSources()
      resetForm()
    }
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  async function loadActiveSources() {
    setLoading(true)
    setError(null)
    try {
      const [sess, team, proj] = await Promise.all([
        sessionId
          ? supabase.from('context_sources').select('*').eq('session_id', sessionId).eq('status', 'active').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        teamId
          ? supabase.from('context_sources').select('*').eq('team_id', teamId).eq('scope', 'team').eq('status', 'active').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        projectId
          ? supabase.from('context_sources').select('*').eq('project_id', projectId).eq('scope', 'project').eq('status', 'active').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setSessionSources((sess.data ?? []) as ContextSource[])
      setTeamSources((team.data ?? []) as ContextSource[])
      setProjectSources((proj.data ?? []) as ContextSource[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading context')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFile(null)
    setFormNotes('')
    setScope('team')
    setUploadDone(false)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setUploadDone(false)
    try {
      const fd = new FormData()
      fd.append('file',        file)
      fd.append('title',       file.name)
      fd.append('scope',       scope)
      fd.append('notes',       formNotes.trim())
      if (teamId)      fd.append('teamId',      teamId)
      if (sessionId)   fd.append('sessionId',   sessionId)
      if (workspaceId) fd.append('workspaceId', workspaceId)
      if (projectId)   fd.append('projectId',   projectId)

      const res = await fetch('/api/context', { method: 'POST', body: fd })
      if (!res.ok && res.status !== 207) {
        let errorMsg = 'Upload failed'
        try {
          const body = await res.json()
          errorMsg = body.error ?? errorMsg
        } catch {
          // Response is not JSON (timeout, HTML error, etc.)
          errorMsg = 'Failed to upload file. Please try again or contact support if the issue persists.'
        }
        throw new Error(errorMsg)
      }
      setUploadDone(true)
      resetForm()
      await loadActiveSources()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function deleteContextFile(id: string) {
    setDeleting(id)
    setError(null)
    try {
      const res = await fetch(`/api/context/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(errData.error || 'Delete failed')
      }
      // Reload sources
      await loadActiveSources()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
      setConfirmDeleteId(null)
    }
  }

  if (!open) return null

  const totalActive = sessionSources.length + teamSources.length + projectSources.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl mx-4 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Add Context File</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[var(--color-text-primary)] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 shrink-0 text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left — Upload */}
          <div className="flex flex-col flex-1 border-r border-gray-200 overflow-hidden min-w-0">
            <div className="px-4 py-2.5 border-b border-gray-800 shrink-0">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Upload</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {/* File input */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none"
                  accept=".txt,.md,.pdf,.docx,.doc,.csv,.json,.html"
                />
                {file && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {file.name} — {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>

              {/* Scope selector */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Scope</label>
                <div className="flex gap-2">
                  {(['team', 'session', 'project'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                        scope === s
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {s === 'session' ? 'Session' : s === 'team' ? 'Team' : 'Project'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  {scope === 'session' && 'Available only in this agent session.'}
                  {scope === 'team'    && 'Available to all agents in this team.'}
                  {scope === 'project' && 'Available across all teams in the project.'}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Notes <span className="text-gray-600">(optional)</span></label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="What is this file about?"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-600 outline-none focus:border-[var(--color-border-focus)] transition-colors resize-none"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{uploadError}</p>
              )}
              {uploadDone && (
                <p className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-900 rounded-lg px-3 py-2">
                  File uploaded successfully.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>

              <p className="text-[10px] text-gray-600">
                Supported: TXT, MD, PDF, DOCX, CSV, JSON, HTML. Text is extracted automatically when possible.
              </p>
            </div>
          </div>

          {/* Right — Active in this context */}
          <div className="flex flex-col overflow-hidden min-h-0" style={{ width: '280px', minWidth: '280px' }}>
            <div className="px-4 py-2.5 border-b border-gray-800 shrink-0 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active in this context</span>
              {totalActive > 0 && (
                <span className="text-[10px] text-gray-500">{totalActive}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
              {loading ? (
                <p className="text-xs text-gray-500 pt-2">Loading…</p>
              ) : (
                <>
                  <ContextSection
                    label="Session Context"
                    items={sessionSources}
                    emptyNote={!sessionId ? 'No session ID available' : 'None'}
                    deleting={deleting}
                    onDelete={(id) => setConfirmDeleteId(id)}
                  />
                  <ContextSection
                    label="Inherited from Team"
                    items={teamSources}
                    emptyNote={!teamId ? 'No team ID available' : 'None'}
                    deleting={deleting}
                    onDelete={(id) => setConfirmDeleteId(id)}
                  />
                  <ContextSection
                    label="Inherited from Project"
                    items={projectSources}
                    emptyNote={!projectId ? 'Open /context to manage project-scope files' : 'None'}
                    deleting={deleting}
                    onDelete={(id) => setConfirmDeleteId(id)}
                  />
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Delete file?</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Warning: The original file will be deleted from storage and cannot be recovered. AISync will keep only metadata and traceability records. This file will no longer be available as AI context. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-xs px-4 py-2 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDeleteId) deleteContextFile(confirmDeleteId)
                }}
                className="text-xs px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContextSection({
  label, items, emptyNote, deleting, onDelete,
}: {
  label:     string
  items:     ContextSource[]
  emptyNote: string
  deleting:  string | null
  onDelete:  (id: string) => void
}) {
  function getScopeLabel(scope: string | null | undefined) {
    if (!scope) return null
    const labels: Record<string, string> = {
      project: 'Project',
      team:    'Team',
      session: 'Session',
    }
    return labels[scope] ?? scope
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600 italic">{emptyNote}</p>
      ) : items.map(s => {
        const scopeLabel = getScopeLabel(s.scope)
        return (
          <div key={s.id} className="py-1.5 border-b border-gray-800/60">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--color-text-primary)] truncate">{s.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {scopeLabel && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700 mr-1">
                      {scopeLabel}
                    </span>
                  )}
                  {s.file_type?.split('/').pop() ?? s.source_kind ?? '—'}
                  {' · '}
                  {s.extracted_text_available ? (
                    <span className="text-emerald-500">text extracted</span>
                  ) : (
                    <span className="text-gray-600">no text</span>
                  )}
                  {s.notes && <> · {s.notes}</>}
                </p>
              </div>
              <button
                onClick={() => onDelete(s.id)}
                disabled={deleting === s.id}
                className="text-[10px] text-gray-500 hover:text-red-500 disabled:opacity-50 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50 shrink-0"
              >
                {deleting === s.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
