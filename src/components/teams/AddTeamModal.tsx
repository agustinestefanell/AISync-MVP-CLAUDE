'use client'

import { useEffect, useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'

const CLOUD_PROVIDERS = ['Anthropic', 'OpenAI', 'Google'] as const
type CloudProvider = typeof CLOUD_PROVIDERS[number]

const MODELS: Record<CloudProvider, string[]> = {
  Anthropic: ['Claude 3.5 Sonnet', 'Claude 3 Opus'],
  OpenAI:    ['GPT-4o', 'GPT-4 Turbo'],
  Google:    ['Gemini 2.0', 'Gemini 2.5 Flash', 'Gemini 1.5 Flash', 'Gemini 1.5 Pro'],
}

interface CustomProviderInfo { name: string; model: string }

interface AgentConfig {
  role: string
  provider: string
  model: string
  endpoint: string
}

function defaultAgents(): AgentConfig[] {
  return [
    { role: 'manager', provider: 'Google',    model: 'Gemini 2.0',       endpoint: '' },
    { role: 'worker1', provider: 'Anthropic', model: 'Claude 3.5 Sonnet', endpoint: '' },
    { role: 'worker2', provider: 'OpenAI',    model: 'GPT-4o',            endpoint: '' },
  ]
}

function computeType(agents: AgentConfig[]) {
  return new Set(agents.map(a => a.provider)).size === 1 ? 'SAT' : 'MAT'
}

const AGENT_ROLES = [
  { role: 'manager', label: 'Manager' },
  { role: 'worker1', label: 'Worker 1' },
  { role: 'worker2', label: 'Worker 2' },
]

interface AddTeamModalProps {
  projectId: string
  teams: TeamWithWorkspaces[]
  onClose: () => void
  onCreated: (team: TeamWithWorkspaces) => void
}

export default function AddTeamModal({ projectId, teams, onClose, onCreated }: AddTeamModalProps) {
  const [name, setName]               = useState('')
  const [parentId, setParentId]       = useState('')
  const [agents, setAgents]           = useState<AgentConfig[]>(defaultAgents)
  const [customProviders, setCustomProviders] = useState<CustomProviderInfo[]>([])
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    fetch('/api/settings/providers')
      .then(r => r.json())
      .then((data: CustomProviderInfo[]) => setCustomProviders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const teamType = computeType(agents)
  const isCloud    = (p: string) => (CLOUD_PROVIDERS as readonly string[]).includes(p)
  const isLocal    = (p: string) => p === 'IA Local'

  function setAgentField(i: number, patch: Partial<AgentConfig>) {
    setAgents(prev => prev.map((a, idx) => {
      if (idx !== i) return a
      const next = { ...a, ...patch }
      if (patch.provider !== undefined) {
        const p = patch.provider
        if (isCloud(p)) {
          next.model    = MODELS[p as CloudProvider][0]
          next.endpoint = ''
        } else if (isLocal(p)) {
          next.model    = ''
          next.endpoint = ''
        } else {
          next.model    = customProviders.find(c => c.name === p)?.model ?? ''
          next.endpoint = ''
        }
      }
      return next
    }))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return }
    for (const a of agents) {
      if (isLocal(a.provider) && !a.endpoint.trim()) {
        setError(`Missing endpoint for agent ${a.role}.`); return
      }
      if (!a.model.trim()) {
        setError(`Missing model for agent ${a.role}.`); return
      }
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          projectId,
          parentId: parentId || null,
          agents: agents.map(a => ({
            role:     a.role,
            provider: a.provider,
            model:    a.model.trim(),
            ...(isLocal(a.provider) ? { config: { endpoint: a.endpoint.trim() } } : {}),
          })),
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error creating team.'); return }
      onCreated(await res.json())
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">New Team</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm px-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
            <input
              autoFocus type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Analysis Team"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Sub-team of (optional)</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                <option value="">— None (root) —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs font-medium text-gray-400">Agents</label>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                teamType === 'SAT'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-purple-950 text-purple-400 border-purple-800'
              }`}>{teamType}</span>
            </div>

            <div className="space-y-3">
              {AGENT_ROLES.map((ag, i) => {
                const a = agents[i]
                const local  = isLocal(a.provider)
                const cloud  = isCloud(a.provider)
                return (
                  <div key={ag.role} className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-300">{ag.label}</p>
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

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </div>
    </div>
  )
}
