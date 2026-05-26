'use client'

import { useEffect, useState } from 'react'
import SetupGuide from './SetupGuide'
import CustomProvidersManager from './CustomProvidersManager'

const CLOUD_PROVIDERS = [
  {
    name: 'Anthropic',
    color: 'text-orange-600',
    border: 'border-[var(--color-border-default)]',
    bg: 'bg-[var(--color-surface)]',
    hint: 'Get your API key at console.anthropic.com',
  },
  {
    name: 'OpenAI',
    color: 'text-green-700',
    border: 'border-[var(--color-border-default)]',
    bg: 'bg-[var(--color-surface)]',
    hint: 'Empieza con sk-…',
  },
  {
    name: 'Google',
    color: 'text-blue-600',
    border: 'border-[var(--color-border-default)]',
    bg: 'bg-[var(--color-surface)]',
    hint: 'Google AI Studio API key',
  },
  {
    name: 'Groq',
    color: 'text-amber-600',
    border: 'border-[var(--color-border-default)]',
    bg: 'bg-[var(--color-surface)]',
    hint: 'Get your API key at console.groq.com',
  },
]

interface SavedKey {
  provider: string
  masked: string
}

interface ProviderCardState {
  input: string
  saving: boolean
  deleting: boolean
  error: string
}

export default function ApiKeysManager() {
  const [savedKeys, setSavedKeys]   = useState<SavedKey[]>([])
  const [loading, setLoading]       = useState(true)
  const [states, setStates]         = useState<Record<string, ProviderCardState>>({})

  useEffect(() => {
    fetch('/api/settings/keys')
      .then(r => r.json())
      .then((data: SavedKey[]) => {
        setSavedKeys(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function getState(provider: string): ProviderCardState {
    return states[provider] ?? { input: '', saving: false, deleting: false, error: '' }
  }

  function setField(provider: string, patch: Partial<ProviderCardState>) {
    setStates(prev => ({
      ...prev,
      [provider]: { ...getState(provider), ...patch },
    }))
  }

  function savedKey(provider: string) {
    return savedKeys.find(k => k.provider === provider)
  }

  async function handleSave(provider: string) {
    const { input } = getState(provider)
    if (!input.trim()) return
    setField(provider, { saving: true, error: '' })
    try {
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: input.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        setField(provider, { saving: false, error: d.error ?? 'Error al guardar.' })
        return
      }
      // Refresh masked keys
      const updated = await fetch('/api/settings/keys').then(r => r.json())
      setSavedKeys(Array.isArray(updated) ? updated : [])
      setField(provider, { saving: false, input: '' })
    } catch {
      setField(provider, { saving: false, error: 'Error de red.' })
    }
  }

  async function handleDelete(provider: string) {
    setField(provider, { deleting: true, error: '' })
    try {
      await fetch(`/api/settings/keys?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' })
      setSavedKeys(prev => prev.filter(k => k.provider !== provider))
      setField(provider, { deleting: false })
    } catch {
      setField(provider, { deleting: false, error: 'Error al eliminar.' })
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm animate-pulse">Cargando configuración…</p>
  }

  return (
    <div className="space-y-8">
      {/* Instructivo colapsable */}
      <SetupGuide />

      {/* Cloud providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-4">API Keys de proveedores cloud</h2>
        <div className="space-y-3">
          {CLOUD_PROVIDERS.map(p => {
            const saved = savedKey(p.name)
            const st    = getState(p.name)

            return (
              <div
                key={p.name}
                className={`border rounded-xl px-5 py-4 ${p.border} ${p.bg}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-sm font-bold ${p.color}`}>{p.name}</span>
                  {saved ? (
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      ✓ key guardada
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">sin key</span>
                  )}
                </div>

                {saved && (
                  <p className="text-xs text-gray-500 font-mono mb-3">{saved.masked}</p>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={st.input}
                    onChange={e => setField(p.name, { input: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSave(p.name)}
                    placeholder={saved ? 'Nueva key (reemplaza la actual)' : p.hint}
                    className="flex-1 bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
                  />
                  <button
                    onClick={() => handleSave(p.name)}
                    disabled={!st.input.trim() || st.saving}
                    className="text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    {st.saving ? '…' : 'Guardar'}
                  </button>
                  {saved && (
                    <button
                      onClick={() => handleDelete(p.name)}
                      disabled={st.deleting}
                      className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 px-3 py-2 border border-red-900 rounded-lg transition-colors"
                    >
                      {st.deleting ? '…' : 'Eliminar'}
                    </button>
                  )}
                </div>

                {st.error && (
                  <p className="text-xs text-red-400 mt-2">{st.error}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* IA Local info */}
      <div className="border border-gray-200 rounded-xl px-5 py-4 bg-gray-50/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-gray-600">IA Local</span>
          <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
            sin key necesaria
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Para usar Ollama o LM Studio, seleccioná <strong className="text-gray-400">IA Local</strong> como provider en Add Team / Edit Team e ingresá el endpoint de tu servidor local (ej.{' '}
          <code className="text-gray-400 bg-white px-1 rounded">http://localhost:11434/v1</code>
          ) junto con el nombre del modelo (ej.{' '}
          <code className="text-gray-400 bg-white px-1 rounded">llama3</code>
          ).
        </p>
        <p className="text-xs text-gray-600 mt-2">
          El servidor local debe exponer una API compatible con OpenAI.
        </p>
      </div>

      {/* Providers personalizados */}
      <CustomProvidersManager />

      {/* Env var note */}
      <div className="border border-[var(--color-border-default)] rounded-xl px-5 py-4">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          <strong className="text-[var(--color-text-secondary)]">Prioridad de keys:</strong> Si guardás una key aquí, tiene prioridad sobre las variables de entorno del servidor (
          <code className="text-[var(--color-text-secondary)]">ANTHROPIC_API_KEY</code>,{' '}
          <code className="text-[var(--color-text-secondary)]">OPENAI_API_KEY</code>,{' '}
          <code className="text-[var(--color-text-secondary)]">GOOGLE_AI_API_KEY</code>
          ). Las keys se almacenan en Supabase con RLS — solo vos podés acceder a las tuyas.
        </p>
      </div>
    </div>
  )
}
