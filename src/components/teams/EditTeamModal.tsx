'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router    = useRouter()
  const workspace = team.workspaces[0] ?? null
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

  const [name, setName]               = useState(team.name)
  const [description, setDescription] = useState(team.description ?? '')
  const [leadRole, setLeadRole]       = useState<'manager' | 'submanager' | 'worker'>(team.lead_role ?? 'worker')
  const [parentId, setParentId]       = useState(team.parent_id ?? '')
  const [agents, setAgents]           = useState<AgentEdit[]>(rawAgents.map(toAgentEdit))
  const [focusedAgent, setFocusedAgent] = useState(0)
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

  const focusedAgentData = agents[focusedAgent]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
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

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
            <input
              autoFocus type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this team does (2-3 lines max)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Lead Role */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Lead Role</label>
            <select
              value={leadRole}
              onChange={e => setLeadRole(e.target.value as typeof leadRole)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="manager">Manager</option>
              <option value="submanager">Sub-Manager</option>
              <option value="worker">Worker</option>
            </select>
          </div>

          {/* Sub-team of */}
          {validParents.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Sub-team of (optional)</label>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">— None (root) —</option>
                {validParents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Agents */}
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
                        <select
                          value={a.provider}
                          onChange={e => setAgentField(i, { provider: e.target.value })}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        >
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
                          <select
                            value={a.model}
                            onChange={e => setAgentField(i, { model: e.target.value })}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            {MODELS[a.provider as CloudProvider].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text" value={a.model}
                            onChange={e => setAgentField(i, { model: e.target.value })}
                            placeholder={local ? 'model (e.g. llama3)' : 'model'}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        )}
                      </div>
                      {local && (
                        <input
                          type="text" value={a.endpoint}
                          onChange={e => setAgentField(i, { endpoint: e.target.value })}
                          placeholder="http://localhost:11434/v1"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TEAM CONTROLS ── */}
          <div className="border border-gray-700 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-1">
                Team Controls
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Use this panel for structural operations: rename, add, promote, erase, refresh, and provider reassignment for the focused agent.
              </p>
            </div>

            {agents.length > 0 && (
              <div className="space-y-3">
                {/* Agent Focus */}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                    Agent Focus
                  </label>
                  <select
                    value={focusedAgent}
                    onChange={e => setFocusedAgent(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {agents.map((a, i) => (
                      <option key={a.id} value={i}>{AGENT_LABEL[a.role] ?? a.role}</option>
                    ))}
                  </select>
                </div>

                {focusedAgentData && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                        Agent Name
                      </label>
                      <input
                        readOnly
                        value={AGENT_LABEL[focusedAgentData.role] ?? focusedAgentData.role}
                        className="w-full bg-gray-800/40 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-400 cursor-default"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                        Provider
                      </label>
                      <select
                        value={focusedAgentData.provider}
                        onChange={e => setAgentField(focusedAgent, { provider: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        {CLOUD_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="IA Local">IA Local</option>
                        {customProviders.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['Add Agent', 'Promote', 'Erase Agent', 'Refresh'] as const).map(label => (
                <button
                  key={label}
                  disabled
                  title="Coming soon"
                  className="text-[11px] py-2 rounded-lg border border-gray-700 text-gray-600 cursor-not-allowed opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Erase Team */}
            <button
              onClick={handleDelete}
              disabled={saving}
              className={`w-full text-xs font-medium py-2 rounded-lg transition-colors ${
                confirming
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'border border-red-900 text-red-600 hover:text-red-400 hover:border-red-700'
              }`}
            >
              {confirming ? 'Confirm deletion?' : 'Erase Team'}
            </button>

            <p className="text-[10px] text-gray-600 leading-relaxed">
              Add grows the team. Promote creates a new sub-manager branch. Erase removes the selected agent or branch. Refresh cycles the provider. Erase Team removes only the active family scope.
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
          <div>
            {workspace && (
              <button
                onClick={() => router.push(`/workspace/${workspace.id}`)}
                className="text-xs text-gray-400 hover:text-indigo-400 border border-gray-700 hover:border-indigo-700 px-3 py-2 rounded-lg transition-colors"
              >
                Go to Workspace
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
