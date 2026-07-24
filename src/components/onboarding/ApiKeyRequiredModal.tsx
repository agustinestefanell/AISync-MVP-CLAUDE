'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const providers = [
  {
    name: 'Google',
    description: 'Free tier',
    link: 'https://aistudio.google.com',
  },
  {
    name: 'Anthropic',
    description: 'Claude',
    link: 'https://console.anthropic.com',
  },
  {
    name: 'OpenAI',
    description: 'Paid',
    link: 'https://platform.openai.com',
  },
]

export default function ApiKeyRequiredModal({ onClose, onSuccess }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      setError('Please select a provider and enter your API key.')
      return
    }

    setError('')
    setIsSaving(true)

    try {
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, key: apiKey.trim() }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        setError(errorData?.error ?? 'Failed to save API key. Please try again.')
        setIsSaving(false)
        return
      }

      // Success — close modal and continue onboarding
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Choose your AI provider
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSaving}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Para usar AISync necesitás tu propia clave de acceso a un proveedor de IA (como ChatGPT o Claude). Esto tiene un costo pequeño según el uso, pero muchísimos proveedores dan crédito gratis para empezar.
        </p>

        <p className="text-xs text-gray-500 mb-4">
          Elegí un proveedor abajo y pegá tu API key para continuar.
        </p>

        <div className="space-y-3 mb-4">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedProvider === provider.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedProvider(provider.name)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">
                    {provider.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {provider.description}
                  </div>
                </div>
                <a
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Get key →
                </a>
              </div>
            </div>
          ))}
        </div>

        {selectedProvider && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {selectedProvider} API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 mb-4">{error}</p>
        )}

        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedProvider || !apiKey.trim()}
              className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Start working'}
            </button>
          </div>
          <a
            href="/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700 underline"
          >
            How to connect your AI agents? Quick setup guide →
          </a>
          <a
            href="/settings"
            className="block text-center text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Manage API Keys
          </a>
        </div>
      </div>
    </div>
  )
}
