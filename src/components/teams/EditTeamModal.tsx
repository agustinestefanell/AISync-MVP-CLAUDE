'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeamWithWorkspaces, AgentSession } from '@/lib/db/types'

const CLOUD_PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Groq'] as const
type CloudProvider = typeof CLOUD_PROVIDERS[number]

const MODELS: Record<CloudProvider, string[]> = {
  Anthropic: ['Claude 3.5 Sonnet', 'Claude 3 Opus'],
  OpenAI:    ['GPT-4o', 'GPT-4 Turbo'],
  Google:    ['Gemini 2.0', 'Gemini 2.5 Flash', 'Gemini 1.5 Flash', 'Gemini 1.5 Pro'],
  Groq:      ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

interface CustomProviderInfo { name: string; model: string }

interface AgentEdit {
  id: string
  role: string
  provider: string
  model: string
  endpoint: string
  description: string
}

function computeType(agents: AgentEdit[]) {
  return new Set(agents.map(a => a.provider)).size === 1 ? 'SAT' : 'MAT'
}

interface EditTeamModalProps {
  team: TeamWithWorkspaces
  allTeams: TeamWithWorkspaces[]
  onClose: () => void
  onUpdated: (team: TeamWithWorkspaces) => void
  onDeleted: (teamId: string) => void
}

export default function EditTeamModal({ team, allTeams, onClose, onUpdated, onDeleted }: EditTeamModalProps) {
  const router    = useRouter()
  const workspace = team.workspaces[0] ?? null
  const rawAgents: AgentSession[] = workspace?.agent_sessions ?? []

  function toAgentEdit(a: AgentSession): AgentEdit {
    return {
      id:          a.id,
      role:        a.agent_role,
      provider:    a.provider,
      model:       a.model,
      endpoint:    (a.config?.endpoint as string) ?? '',
      description: a.agent_role === 'manager'
        ? (a.description ?? team.description ?? '')
        : (a.description ?? ''),
    }
  }

  const [name, setName]               = useState(team.name)
  const [description, setDescription] = useState(team.description ?? '')
  const [leadRole]                    = useState<'manager' | 'submanager' | 'worker'>(team.lead_role ?? 'worker')
  const [parentId, setParentId]       = useState(team.parent_id ?? '')
  const [agents, setAgents]           = useState<AgentEdit[]>(rawAgents.map(toAgentEdit))
  const [customProviders, setCustomProviders] = useState<CustomProviderInfo[]>([])
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [confirming, setConfirming]   = useState(false)

  useEffect(() => {
    fetch('/api/settings/providers')
      .then(r => r.json())
      .then((data: CustomProviderInfo[]) => setCustomProviders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const teamType     = computeType(agents)
  const validParents = allTeams.filter(t => t.id !== team.id)
  const isCloud = (p: string) => (CLOUD_PROVIDERS as readonly string[]).includes(p)
  const isLocal = (p: string) => p === 'IA Local'

  function setAgentField(i: number, patch: Partial<AgentEdit>) {
    setAgents(prev => prev.map((a, idx) => {
      if (idx !== i) return a
      const next = { ...a, ...patch }
      if (patch.provider !== undefined) {
        const p = patch.provider
        if (isCloud(p)) {
          const currentOk = MODELS[p as CloudProvider].includes(next.model)
          next.model    = currentOk ? next.model : MODELS[p as CloudProvider][0]
          next.endpoint = ''
        } else if (isLocal(p)) {
          next.model    = ''
          next.endpoint = ''
        } else {
          next.model    = customProviders.find(c => c.name === p)?.model ?? next.model
          next.endpoint = ''
        }
      }
      return next
    }))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!description.trim()) { setError('Description is required.'); return }
    for (const a of agents) {
      if (isLocal(a.provider) && !a.endpoint.trim()) {
        setError(`Missing endpoint for ${AGENT_LABEL[a.role] ?? a.role}.`); return
      }
      if (!a.model.trim()) {
        setError(`Missing model for ${AGENT_LABEL[a.role] ?? a.role}.`); return
      }
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          description: description.trim() || null,
          lead_role:   leadRole,
          parentId:    parentId || null,
          agents:      agents.map(a => ({
            id:          a.id,
            provider:    a.provider,
            model:       a.model.trim(),
            config:      isLocal(a.provider) ? { endpoint: a.endpoint.trim() } : null,
            description: a.description.trim() || null,
          })),
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error updating team.'); return }
      onUpdated(await res.json())
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error.'); setSaving(false); return }
      onDeleted(team.id)
    } catch { setError('Network error.'); setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-5xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-3.5 border-b border-[var(--color-border-default)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] shrink-0">Edit Team</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold shrink-0 ${
              teamType === 'SAT'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>{teamType}</span>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2 shrink-0">✕</button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Team identity row ── */}
          <div className={`grid gap-3 mb-4 items-start ${validParents.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Name *</label>
              <input
                autoFocus type="text" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what this team does"
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors resize-none"
              />
            </div>
            {validParents.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Sub-team of</label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
                >
                  <option value="">— None —</option>
                  {validParents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ── Agents — 3-column grid ── */}
          {agents.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {agents.map((a, i) => {
                  const local = isLocal(a.provider)
                  const cloud = isCloud(a.provider)
                  return (
                    <div key={a.id} className="bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-3 space-y-2">
                      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{AGENT_LABEL[a.role] ?? a.role}</p>
                      <select
                        value={a.provider}
                        onChange={e => setAgentField(i, { provider: e.target.value })}
                        className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
                      >
                        <optgroup label="Cloud">
                          {CLOUD_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </optgroup>
                        <optgroup label="Local">
                          <option value="IA Local">IA Local</option>
                        </optgroup>
                        {customProviders.filter(p => !CLOUD_PROVIDERS.includes(p.name as CloudProvider)).length > 0 && (
                          <optgroup label="Custom">
                            {customProviders.filter(p => !CLOUD_PROVIDERS.includes(p.name as CloudProvider)).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      {cloud ? (
                        <select
                          value={a.model}
                          onChange={e => setAgentField(i, { model: e.target.value })}
                          className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
                        >
                          {MODELS[a.provider as CloudProvider].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text" value={a.model}
                          onChange={e => setAgentField(i, { model: e.target.value })}
                          placeholder={local ? 'model (e.g. llama3)' : 'model'}
                          className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
                        />
                      )}
                      {local && (
                        <input
                          type="text" value={a.endpoint}
                          onChange={e => setAgentField(i, { endpoint: e.target.value })}
                          placeholder="http://localhost:11434/v1"
                          className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
                        />
                      )}
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--color-text-muted)] mb-1">Description</label>
                        <textarea
                          value={a.description}
                          onChange={e => setAgentField(i, { description: e.target.value })}
                          rows={2}
                          placeholder={a.role === 'manager'
                            ? "Describe this agent's focus or specialty"
                            : "Add a role description for this agent"
                          }
                          className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Action buttons row ── */}
              <div className="grid grid-cols-4 gap-2">
                {(['Add Agent', 'Promote', 'Erase Agent', 'Refresh'] as const).map(label => (
                  <button
                    key={label}
                    disabled
                    title="Coming soon"
                    className="text-[11px] py-2 rounded-lg border border-gray-200 text-gray-600 cursor-not-allowed opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-3.5 border-t border-[var(--color-border-default)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {workspace && (
              <button
                onClick={() => router.push(`/workspace/${workspace.id}`)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-indigo-600 border border-[var(--color-border-default)] hover:border-indigo-400 px-3 py-2 rounded-lg transition-colors"
              >
                Go to Workspace
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={saving}
              className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                confirming
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'border border-red-900 text-red-600 hover:text-red-400 hover:border-red-700'
              }`}
            >
              {confirming ? 'Confirm deletion?' : 'Erase Team'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
