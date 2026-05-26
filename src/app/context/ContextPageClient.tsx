'use client'

import { useState, useEffect, useCallback } from 'react'
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
  userId: string
}

export default function ContextPageClient({ userId }: Props) {
  const supabase = createClient()
  const [sources,  setSources]  = useState<ContextSource[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('context_sources')
        .select('id,title,scope,source_kind,file_type,file_size_bytes,extracted_text_available,notes,created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (err) throw err
      setSources((data ?? []) as ContextSource[])
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

  const projectSources = sources.filter(s => s.scope === 'project')
  const teamSources    = sources.filter(s => s.scope === 'team')
  const sessionSources = sources.filter(s => s.scope === 'session')

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Context Files</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Files uploaded to provide context to your AI agents.
          </p>
        </div>

        {error && (
          <div className="mb-6 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : (
          <div className="space-y-10">
            <ContextSection
              title="Project Context"
              description="Available across all teams in the project."
              items={projectSources}
              archiving={archiving}
              onArchive={archive}
            />
            <ContextSection
              title="Team Context"
              description="Available to all agents in the team."
              items={teamSources}
              archiving={archiving}
              onArchive={archive}
            />
            <ContextSection
              title="Session Context"
              description="Available only within a specific agent session."
              items={sessionSources}
              archiving={archiving}
              onArchive={archive}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ContextSection({
  title, description, items, archiving, onArchive,
}: {
  title:       string
  description: string
  items:       ContextSource[]
  archiving:   string | null
  onArchive:   (id: string) => void
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] italic">No files in this scope.</p>
      ) : (
        <div className="border border-[var(--color-border-default)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
          {items.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 px-4 py-3 ${
                i < items.length - 1 ? 'border-b border-[var(--color-border-default)]' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{s.title}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {s.file_type?.split('/').pop() ?? s.source_kind ?? '—'}
                  {s.file_size_bytes != null && (
                    <> · {(s.file_size_bytes / 1024).toFixed(1)} KB</>
                  )}
                  {' · '}
                  {s.extracted_text_available ? (
                    <span className="text-emerald-600">text extracted</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">no text</span>
                  )}
                  {s.notes && <> · {s.notes}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => onArchive(s.id)}
                  disabled={archiving === s.id}
                  className="text-[11px] text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-50 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                  {archiving === s.id ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
