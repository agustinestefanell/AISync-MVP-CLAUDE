'use client'

import { useEffect, useState } from 'react'
import type { TeamWithWorkspaces, AgentSession } from '@/lib/db/types'

const CLOUD_PROVIDERS = ['Anthropic', 'OpenAI', 'Google'] as const
type CloudProvider = typeof CLOUD_PROVIDERS[number]

const MODELS: Record<CloudProvider, string[]> = {
  Anthropic: ['Claude 3.5 Sonnet', 'Claude 3 Opus'],
  OpenAI:    ['GPT-4o', 'GPT-4 Turbo'],
  Google:    ['Gemini 2.0', 'Gemini 2.5 Flash', 'Gemini 1.5 Flash', 'Gemini 1.5 Pro'],
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
  const workspace  = team.workspaces[0] ?? null
  const rawAgents: AgentSession[] = workspace?.agent_sessions ?? []

  function toAgentEdit(a: AgentSession): AgentEdit {
    return {
      id:       a.id,
      role:     a.agent_role,
      provider: a.provider,
      model:    a.model,
      endpoint: (a.config?.endpoint as string) ?? '',
    }
  }

  const [name, setName]           = useState(team.name)
  const [parentId, setParentId]   = useState(team.parent_id ?? '')
  const [agents, setAgents]       = useState<AgentEdit[]>(rawAgents.map(toAgentEdit))
  const [customProviders, setCustomProviders] = useState<CustomProviderInfo[]>([])
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetch('/api/settings/providers')
      .then(r => r.json())
      .then((data: CustomProviderInfo[]) => setCustomProviders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const teamType   = computeType(agents)
  const validParents = allTeams.filter(t => t.id !== team.id)
  const isCloud    = (p: string) => (CLOUD_PROVIDERS as readonly string[]).includes(p)
  const isLocal    = (p: string) => p === 'IA Local'

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
          name: name.trim(),
          parentId: parentId || null,
          agents: agents.map(a => ({
            id:       a.id,
            provider: a.provider,
            model:    a.model.trim(),
            config:   isLocal(a.provider) ? { endpoint: a.endpoint.trim() } : null,
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Edit Team</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
              teamType === 'SAT'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : 'bg-purple-950 text-purple-400 border-purple-800'
            }`}>{teamType}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm px-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>

          {validParents.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Sub-team of (optional)</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                <option value="">— None (root) —</option>
                {validParents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {agents.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-3">Agents</label>
              <div className="space-y-3">
                {agents.map((a, i) => {
                  const local = isLocal(a.provider)
                  const cloud = isCloud(a.provider)
                  return (
                    <div key={a.id} className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-300">{AGENT_LABEL[a.role] ?? a.role}</p>
                      <div className="flex gap-2">
                        <select value={a.provider} onChange={e => setAgentField(i, { provider: e.target.value })}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors">
                          <optgroup label="Cloud">
                            {CLOUD_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                          </optgroup>
                          <optgroup label="Local">
                            <option value="IA Local">IA Local</option>
                          </optgroup>
                          {customProviders.length > 0 && (
                            <optgroup label="Custom">
                              {customProviders.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </optgroup>
                          )}
                        </select>

                        {cloud ? (
                          <select value={a.model} onChange={e => setAgentField(i, { model: e.target.value })}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors">
                            {MODELS[a.provider as CloudProvider].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={a.model} onChange={e => setAgentField(i, { model: e.target.value })}
                            placeholder={local ? 'model (e.g. llama3)' : 'model'}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                        )}
                      </div>

                      {local && (
                        <input type="text" value={a.endpoint} onChange={e => setAgentField(i, { endpoint: e.target.value })}
                          placeholder="http://localhost:11434/v1"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <button onClick={handleDelete} disabled={saving}
            className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              confirming ? 'bg-red-600 hover:bg-red-500 text-white' : 'text-red-500 hover:text-red-400'
            }`}>
            {confirming ? 'Confirm deletion?' : 'Delete team'}
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
