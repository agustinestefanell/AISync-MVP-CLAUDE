'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Prompt {
  id:         string
  user_id:    string
  title:      string
  body:       string
  scope:      'worker' | 'team' | null
  status:     string
  version:    number
  tags:       string[] | null
  notes:      string | null
  created_at: string
  updated_at: string
}

interface Assignment {
  id:          string
  prompt_id:   string
  assigned_to: 'worker' | 'team'
  target_id:   string
  agent_role:  string | null
  is_active:   boolean
  prompt:      Prompt | null
}

interface Props {
  open:        boolean
  onClose:     () => void
  userId?:     string
  teamId:      string
  teamType?:   'SAT' | 'MAT'
  workspaceId?: string
  sessionId:   string
  agentRole:   string
}

export default function PromptLibrary({
  open, onClose, teamId, sessionId, agentRole,
}: Props) {
  const supabase = createClient()

  const [userId,            setUserId]            = useState<string | null>(null)
  const [prompts,           setPrompts]           = useState<Prompt[]>([])
  const [workerAssignments, setWorkerAssignments] = useState<Assignment[]>([])
  const [teamAssignments,   setTeamAssignments]   = useState<Assignment[]>([])
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState<string | null>(null)

  const [showGuide,  setShowGuide]  = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<Prompt | null>(null)
  const [formTitle,  setFormTitle]  = useState('')
  const [formBody,   setFormBody]   = useState('')
  const [formNotes,  setFormNotes]  = useState('')
  const [formTags,   setFormTags]   = useState('')
  const [formError,  setFormError]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (open) loadData()
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }
      setUserId(user.id)

      const { data: promptData, error: pErr } = await supabase
        .from('prompt_library')
        .select('*')
        .order('created_at', { ascending: false })
      if (pErr) throw pErr
      setPrompts((promptData ?? []) as Prompt[])

      await Promise.all([
        loadWorkerAssignments(),
        loadTeamAssignments(),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading prompts')
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkerAssignments() {
    if (!sessionId) return
    const { data: assign } = await supabase
      .from('prompt_assignments')
      .select('*')
      .eq('assigned_to', 'worker')
      .eq('target_id', sessionId)
      .eq('is_active', true)

    if (!assign || assign.length === 0) { setWorkerAssignments([]); return }

    const ids = assign.map((a: Record<string, string>) => a.prompt_id)
    const { data: ps } = await supabase.from('prompt_library').select('*').in('id', ids)
    const map = new Map(((ps ?? []) as Prompt[]).map(p => [p.id, p]))
    setWorkerAssignments(assign.map((a: Record<string, unknown>) => ({
      ...(a as unknown as Assignment),
      prompt: map.get(a.prompt_id as string) ?? null,
    })))
  }

  async function loadTeamAssignments() {
    if (!teamId) return
    const { data: assign } = await supabase
      .from('prompt_assignments')
      .select('*')
      .eq('assigned_to', 'team')
      .eq('target_id', teamId)
      .eq('is_active', true)

    if (!assign || assign.length === 0) { setTeamAssignments([]); return }

    const ids = assign.map((a: Record<string, string>) => a.prompt_id)
    const { data: ps } = await supabase.from('prompt_library').select('*').in('id', ids)
    const map = new Map(((ps ?? []) as Prompt[]).map(p => [p.id, p]))
    setTeamAssignments(assign.map((a: Record<string, unknown>) => ({
      ...(a as unknown as Assignment),
      prompt: map.get(a.prompt_id as string) ?? null,
    })))
  }

  function openCreate() {
    setEditing(null)
    setFormTitle('')
    setFormBody('')
    setFormNotes('')
    setFormTags('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(p: Prompt) {
    setEditing(p)
    setFormTitle(p.title)
    setFormBody(p.body)
    setFormNotes(p.notes ?? '')
    setFormTags(p.tags?.join(', ') ?? '')
    setFormError(null)
    setShowForm(true)
  }

  async function savePrompt() {
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (!formBody.trim())  { setFormError('Prompt body is required'); return }
    if (!userId) return
    setSaving(true)
    setFormError(null)
    const parsedTags = formTags.split(',').map(t => t.trim()).filter(Boolean)
    try {
      if (editing) {
        const { error } = await supabase
          .from('prompt_library')
          .update({
            title:      formTitle.trim(),
            body:       formBody.trim(),
            notes:      formNotes.trim() || null,
            tags:       parsedTags.length ? parsedTags : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('prompt_library')
          .insert({
            user_id: userId,
            title:   formTitle.trim(),
            body:    formBody.trim(),
            notes:   formNotes.trim() || null,
            tags:    parsedTags.length ? parsedTags : null,
          })
        if (error) throw error
      }
      setShowForm(false)
      setEditing(null)
      setFormTitle('')
      setFormBody('')
      setFormNotes('')
      setFormTags('')
      await loadData()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error saving prompt')
    } finally {
      setSaving(false)
    }
  }

  async function assignToWorker(promptId: string) {
    setError(null)
    try {
      const { data: existing } = await supabase
        .from('prompt_assignments')
        .select('id')
        .eq('prompt_id', promptId)
        .eq('assigned_to', 'worker')
        .eq('target_id', sessionId)
        .maybeSingle()

      if (existing) {
        await supabase.from('prompt_assignments').update({ is_active: true }).eq('id', existing.id)
      } else {
        await supabase.from('prompt_assignments').insert({
          prompt_id:   promptId,
          assigned_to: 'worker',
          target_id:   sessionId,
          agent_role:  agentRole,
          is_active:   true,
        })
      }
      await loadWorkerAssignments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error assigning to worker')
    }
  }

  async function assignToTeam(promptId: string) {
    setError(null)
    try {
      const { data: existing } = await supabase
        .from('prompt_assignments')
        .select('id')
        .eq('prompt_id', promptId)
        .eq('assigned_to', 'team')
        .eq('target_id', teamId)
        .maybeSingle()

      if (existing) {
        await supabase.from('prompt_assignments').update({ is_active: true }).eq('id', existing.id)
      } else {
        await supabase.from('prompt_assignments').insert({
          prompt_id:   promptId,
          assigned_to: 'team',
          target_id:   teamId,
          agent_role:  null,
          is_active:   true,
        })
      }
      await loadTeamAssignments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error assigning to team')
    }
  }

  async function unassign(assignmentId: string) {
    setError(null)
    try {
      await supabase.from('prompt_assignments').update({ is_active: false }).eq('id', assignmentId)
      await Promise.all([loadWorkerAssignments(), loadTeamAssignments()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error unassigning prompt')
    }
  }

  if (!open) return null

  const workerAssignedIds = new Set(workerAssignments.map(a => a.prompt_id))
  const teamAssignedIds   = new Set(teamAssignments.map(a => a.prompt_id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl mx-4 shadow-2xl flex flex-col overflow-hidden" style={{ height: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Prompt Library</h2>
            <button
              className="text-[11px] text-teal-600 underline underline-offset-2 hover:opacity-75"
              onClick={() => setShowGuide(true)}
            >
              How to use Prompt Library
            </button>
          </div>
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

          {/* Left — Library */}
          <div className="flex flex-col flex-1 border-r border-gray-200 overflow-hidden min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Library</span>
              <button
                onClick={openCreate}
                className="text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] text-white px-3 py-1 rounded-lg transition-colors"
              >
                + New Prompt
              </button>
            </div>

            {/* Create / Edit form */}
            {showForm && (
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/40 shrink-0 space-y-2">
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)] transition-colors"
                />
                <textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Prompt instructions…"
                  rows={10}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)] transition-colors resize-y"
                />
                <input
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)] transition-colors"
                />
                <input
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-500 outline-none focus:border-[var(--color-border-focus)] transition-colors"
                />
                {formError && <p className="text-xs text-red-400">{formError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={savePrompt}
                    disabled={saving}
                    className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-600 text-gray-600 text-xs rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Prompt list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
              {loading ? (
                <p className="text-xs text-gray-500 py-6 text-center">Loading…</p>
              ) : prompts.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No prompts yet. Create your first prompt.</p>
              ) : prompts.map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/30 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.body}</p>
                    </div>
                    <button
                      onClick={() => openEdit(p)}
                      className="shrink-0 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100/60 text-gray-400">v{p.version}</span>
                    {p.scope && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100/60 text-gray-400">{p.scope}</span>
                    )}
                    {p.tags?.length ? p.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{tag}</span>
                    )) : null}
                    {p.status !== 'active' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-500">{p.status}</span>
                    )}
                    <div className="flex gap-1.5 ml-auto">
                      <button
                        onClick={() => assignToWorker(p.id)}
                        disabled={workerAssignedIds.has(p.id)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {workerAssignedIds.has(p.id) ? '✓ Worker' : '+ Worker'}
                      </button>
                      <button
                        onClick={() => assignToTeam(p.id)}
                        disabled={teamAssignedIds.has(p.id)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {teamAssignedIds.has(p.id) ? '✓ Team' : '+ Team'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Active in this context */}
          <div className="flex flex-col overflow-hidden min-h-0" style={{ width: '280px', minWidth: '280px' }}>
            <div className="px-4 py-2.5 border-b border-gray-800 shrink-0">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active in this context</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 min-h-0">

              {!sessionId ? (
                <div className="text-[11px] text-[var(--color-text-secondary)] italic p-3 border border-[var(--color-border)] rounded-lg">
                  To manage prompt assignments, open Prompt Library from an agent panel.
                </div>
              ) : (
                <>
                  {/* Assigned to this Worker */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Assigned to this Worker
                    </p>
                    {workerAssignments.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">None assigned</p>
                    ) : workerAssignments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/60"
                      >
                        <p className="text-xs text-[var(--color-text-primary)] truncate flex-1">{a.prompt?.title ?? '—'}</p>
                        <button
                          onClick={() => unassign(a.id)}
                          className="shrink-0 text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Inherited from Team */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Inherited from Team
                    </p>
                    {teamAssignments.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">None assigned</p>
                    ) : teamAssignments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/60"
                      >
                        <p className="text-xs text-[var(--color-text-primary)] truncate flex-1">{a.prompt?.title ?? '—'}</p>
                        <button
                          onClick={() => unassign(a.id)}
                          className="shrink-0 text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* Guide modal */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowGuide(false) }}
        >
          <div className="bg-[#f0f0f0] border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to use Prompt Library
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
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{`Use Prompt Library to assign reusable prompts to:
→ one Worker
→ one Team
→ multiple Workers
→ multiple Teams
→ or any combination of them

You can associate the same prompt in many places without rewriting it. You can also de-associate it from any Worker or Team when it should no longer apply there.

Use a team prompt when the whole team should follow the same instruction. Use a worker prompt when one agent needs a more specific role or specialization.

In practical terms, Prompt Library lets you reuse, assign, and remove prompts in a controlled way instead of rewriting them manually.`}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
