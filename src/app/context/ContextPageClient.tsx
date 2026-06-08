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
  created_at:               string
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to use Context Files"
        pageSubtitleOnClick={() => setShowGuide(true)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10">
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
