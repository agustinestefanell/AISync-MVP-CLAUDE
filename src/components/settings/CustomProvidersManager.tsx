'use client'

import { useEffect, useState } from 'react'

interface CustomProvider {
  id: string
  name: string
  endpoint_url: string
  model: string
  masked_key: string
}

const EMPTY_FORM = { name: '', endpoint_url: '', api_key: '', model: '' }

export default function CustomProvidersManager() {
  const [providers, setProviders] = useState<CustomProvider[]>([])
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [deletingName, setDeletingName] = useState<string | null>(null)

  async function load() {
    const data = await fetch('/api/settings/providers').then(r => r.json())
    setProviders(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!form.name.trim() || !form.endpoint_url.trim() || !form.api_key.trim() || !form.model.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error al guardar.')
        return
      }
      setForm(EMPTY_FORM)
      await load()
    } catch {
      setError('Error de red.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name)
    try {
      await fetch(`/api/settings/providers?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      setProviders(prev => prev.filter(p => p.name !== name))
    } finally {
      setDeletingName(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Custom providers</h2>
        <span className="text-xs text-gray-600">Compatible with any OpenAI-format API</span>
      </div>

      {/* Lista de providers guardados */}
      {!loading && providers.length > 0 && (
        <div className="space-y-2">
          {providers.map(p => (
            <div
              key={p.id}
              className="flex items-start gap-3 bg-gray-50/40 border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">{p.name}</span>
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    active
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{p.endpoint_url}</p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>Model: <span className="text-gray-400">{p.model}</span></span>
                  <span>Key: <span className="font-mono">{p.masked_key}</span></span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.name)}
                disabled={deletingName === p.name}
                className="shrink-0 text-xs text-red-600 hover:text-red-400 disabled:opacity-40 transition-colors px-2 py-1 border border-red-900/50 rounded-lg"
              >
                {deletingName === p.name ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar */}
      <div className="border border-gray-200 rounded-xl px-4 py-4 space-y-3 bg-white/30">
        <p className="text-xs font-medium text-gray-400">
          {providers.length === 0 ? 'Add your first custom provider' : 'Add another provider'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Perplexity, Mistral, DeepSeek…"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Default model *</label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder="llama-3.1-sonar-large…"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Endpoint URL *</label>
          <input
            type="text"
            value={form.endpoint_url}
            onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))}
            placeholder="https://api.perplexity.ai"
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">API Key *</label>
          <input
            type="password"
            value={form.api_key}
            onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
            placeholder="pplx-…"
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-600">
            The model can be changed per agent when creating a team.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Add provider'}
          </button>
        </div>
      </div>
    </div>
  )
}
