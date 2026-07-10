'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'
import { computeTeamCodes } from '@/lib/teams/computeTeamCodes'

const CLOUD_PROVIDERS = ['Anthropic', 'OpenAI', 'Google'] as const
type CloudProvider = typeof CLOUD_PROVIDERS[number]

const DEFAULT_MODELS: Record<CloudProvider, string> = {
  Anthropic: 'Claude Sonnet 4.6',
  OpenAI:    'GPT-5.5',
  Google:    'Gemini 3.5 Flash',
}

interface CustomProviderInfo { name: string; model: string }

interface AddTeamModalProps {
  projectId: string
  teams:     TeamWithWorkspaces[]
  parentTeamId?: string
  onClose:   () => void
  onCreated: (team: TeamWithWorkspaces) => void
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className="absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full border"
      style={{
        borderColor: active ? 'rgba(15,23,42,0.88)' : 'rgba(15,23,42,0.42)',
        background:  'rgba(255,255,255,0.92)',
      }}
    >
      {active ? <span className="h-2 w-2 rounded-full bg-neutral-950" /> : null}
    </span>
  )
}

function ProviderButtons({
  providers,
  selected,
  onSelect,
  disabled,
}: {
  providers: readonly string[]
  selected:  string
  onSelect:  (p: string) => void
  disabled:  boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {providers.map(p => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default ${
            selected === p
              ? 'border-neutral-800 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
          }`}
          onClick={e => { e.stopPropagation(); onSelect(p) }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export default function AddTeamModal({ projectId, teams, parentTeamId, onClose, onCreated }: AddTeamModalProps) {
  const [teamMode, setTeamMode]         = useState<'MAT' | 'SAT'>('MAT')
  const [name, setName]                 = useState('')
  const [description, setDescription]   = useState('')
  const [parentId, setParentId]         = useState(parentTeamId ?? '')
  const [matProviders, setMatProviders] = useState<[string, string, string]>(['Anthropic', 'OpenAI', 'Google'])
  const [satProvider, setSatProvider]   = useState<string>('Anthropic')
  const [customProviders, setCustomProviders] = useState<CustomProviderInfo[]>([])
  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)

  const teamCodes = useMemo(() => computeTeamCodes(teams), [teams])

  useEffect(() => {
    fetch('/api/settings/providers')
      .then(r => r.json())
      .then((data: CustomProviderInfo[]) => setCustomProviders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const allProviders: readonly string[] = [
    ...CLOUD_PROVIDERS,
    ...customProviders.map(p => p.name),
  ]

  function getDefaultModel(provider: string): string {
    if ((CLOUD_PROVIDERS as readonly string[]).includes(provider)) {
      return DEFAULT_MODELS[provider as CloudProvider]
    }
    return customProviders.find(p => p.name === provider)?.model ?? ''
  }

  async function handleSubmit() {
    if (!name.trim())        { setError('Team name is required.');   return }
    if (!description.trim()) { setError('Description is required.'); return }

    setSaving(true)
    setError('')
    try {
      const agents = teamMode === 'SAT'
        ? [
            { role: 'manager', provider: satProvider, model: getDefaultModel(satProvider) },
            { role: 'worker1', provider: satProvider, model: getDefaultModel(satProvider) },
            { role: 'worker2', provider: satProvider, model: getDefaultModel(satProvider) },
          ]
        : [
            { role: 'manager', provider: matProviders[0], model: getDefaultModel(matProviders[0]) },
            { role: 'worker1', provider: matProviders[1], model: getDefaultModel(matProviders[1]) },
            { role: 'worker2', provider: matProviders[2], model: getDefaultModel(matProviders[2]) },
          ]

      const res = await fetch('/api/teams', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        name.trim(),
          description: description.trim(),
          projectId,
          parentId:    parentId || null,
          agents,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error creating team.'); return }
      onCreated(await res.json())
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-5xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-950">Add Team</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-sm px-2 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4">

            {/* Common fields: Name + Description */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Team Name *</label>
                <input
                  autoFocus type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="e.g. Analysis Team"
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-800 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description *</label>
                <input
                  type="text" value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of the team"
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-800 transition-colors"
                />
              </div>
            </div>

            {/* Sub-team selector (optional) */}
            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sub-team of (optional)</label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-800 transition-colors bg-white"
                >
                  <option value="">— None (root) —</option>
                  {[...teams]
                    .sort((a, b) => (teamCodes[a.id] ?? '').localeCompare(teamCodes[b.id] ?? ''))
                    .map(t => <option key={t.id} value={t.id}>{teamCodes[t.id] ?? '—'} · {t.name}</option>)}
                </select>
              </div>
            )}

            {/* MAT / SAT panels side by side */}
            <div className="grid gap-3 sm:grid-cols-2">

              {/* MAT — left */}
              <div
                role="button"
                tabIndex={0}
                className={`relative grid gap-3 rounded-[14px] border px-4 py-4 text-left cursor-pointer transition-opacity ${
                  teamMode === 'MAT'
                    ? 'border-neutral-300 bg-white opacity-100'
                    : 'border-neutral-200 bg-neutral-50 opacity-45'
                }`}
                onClick={() => setTeamMode('MAT')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamMode('MAT') } }}
              >
                <RadioDot active={teamMode === 'MAT'} />
                <div>
                  <div className="text-sm font-semibold text-neutral-950">MAT — Multiple Agent Team</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-600">
                    Team with up to 3 workers for distributed work.
                  </div>
                </div>
                <div className="grid gap-3">
                  {([0, 1, 2] as const).map(i => (
                    <div key={i} className="grid gap-1">
                      <span className="text-xs font-medium text-neutral-600">Worker {i + 1} Agent Source</span>
                      <ProviderButtons
                        providers={allProviders}
                        selected={matProviders[i]}
                        onSelect={p => setMatProviders(prev => {
                          const next = [...prev] as [string, string, string]
                          next[i] = p
                          return next
                        })}
                        disabled={teamMode !== 'MAT'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SAT — right */}
              <div
                role="button"
                tabIndex={0}
                className={`relative grid gap-3 rounded-[14px] border px-4 py-4 text-left cursor-pointer transition-opacity ${
                  teamMode === 'SAT'
                    ? 'border-neutral-300 bg-white opacity-100'
                    : 'border-neutral-200 bg-neutral-50 opacity-45'
                }`}
                onClick={() => setTeamMode('SAT')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamMode('SAT') } }}
              >
                <RadioDot active={teamMode === 'SAT'} />
                <div>
                  <div className="text-sm font-semibold text-neutral-950">SAT — Single Agent Team</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-600">
                    One backend agent with SM, Worker 1, and Worker 2 visible as work branches.
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-600">Agent Source</span>
                  <ProviderButtons
                    providers={allProviders}
                    selected={satProvider}
                    onSelect={setSatProvider}
                    disabled={teamMode !== 'SAT'}
                  />
                </div>
              </div>

            </div>

            <a
              href="/settings"
              className="text-xs text-neutral-700 hover:text-neutral-950 underline"
            >
              Edit API-Keys →
            </a>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-neutral-100 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Create Team'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-800 px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
