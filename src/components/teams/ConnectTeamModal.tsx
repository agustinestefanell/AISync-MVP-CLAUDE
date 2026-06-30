'use client'

import { useState } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'

interface ConnectTeamModalProps {
  teams: TeamWithWorkspaces[]
  onClose: () => void
  onConnected: (connection: Connection) => void
}

export interface Connection {
  id: string
  requester_account_id: string
  requester_email: string
  requester_team_id: string
  requester_team_name: string
  receiver_email: string
  receiver_account_id: string | null
  receiver_team_id: string | null
  receiver_team_name: string | null
  connection_type: string
  scope: string
  status: string
  direction: 'outgoing' | 'incoming'
  created_at: string
  updated_at: string
  description?: string | null
  color?: string | null
}

const CONNECTION_COLORS = [
  // Originales (oscuros neutros)
  '#000000', // Negro
  '#1e3a5f', // Azul oscuro
  '#3b0764', // Violeta
  '#134e4a', // Teal
  '#1c1c1c', // Gris carbón
  '#2d1b69', // Índigo oscuro
  '#1a1a2e', // Azul noche
  '#0f2027', // Verde azulado oscuro
  // Rojos
  '#7f1d1d', // Rojo oscuro
  '#991b1b', // Rojo medio
  '#7c2d12', // Naranja oscuro
  '#78180a', // Rojo ladrillo
  // Verdes
  '#14532d', // Verde oscuro
  '#166534', // Verde medio
  '#15803d', // Verde claro oscuro
  '#065f46', // Esmeralda oscuro
]

export default function ConnectTeamModal({ teams, onClose, onConnected }: ConnectTeamModalProps) {
  const [receiverEmail, setReceiverEmail] = useState('')
  const [description, setDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState(CONNECTION_COLORS[0])
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  // Use first team automatically (no selector shown to user)
  const hostTeamId = teams[0]?.id ?? ''
  const hostTeam = teams.find(t => t.id === hostTeamId)

  async function handleSubmit() {
    if (!hostTeamId) { setError('No team available. Please create a team first.'); return }
    if (!receiverEmail.trim()) { setError('Enter the external account email.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail.trim())) {
      setError('Invalid email.'); return
    }
    if (!description.trim()) { setError('Description is required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_team_id:   hostTeamId,
          requester_team_name: hostTeam?.name ?? '',
          receiver_email:      receiverEmail.trim(),
          description:         description.trim(),
          color:               selectedColor,
          connection_type:     'project-bound',
          scope:               'no-shared-repo',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error sending request.')
        return
      }
      onConnected(await res.json())
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border-default)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Connect Team</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Connect with a team from another AISync account</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Receiver email */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              External account email
            </label>
            <input
              autoFocus
              type="email"
              value={receiverEmail}
              onChange={e => setReceiverEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="other@company.com"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ej: Trabajo con Martín para cliente JML"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>

          {/* Color selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Card color
            </label>
            <div className="grid grid-cols-8 gap-2.5">
              {CONNECTION_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === color
                      ? 'ring-2 ring-indigo-600 ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Connection type</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 bg-[var(--color-badge-structural-bg)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 cursor-pointer">
                <input type="radio" checked readOnly className="mt-0.5 accent-indigo-600" />
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">Project-bound</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Bound to the active project. SM↔SM channel operational.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 bg-gray-50/40 border border-gray-200/50 rounded-xl px-4 py-3 opacity-40 cursor-not-allowed">
                <input type="radio" disabled className="mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">Persistent partner
                    <span className="ml-2 text-xs text-gray-600 font-normal">coming soon</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Permanent connection between organizations.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Scope</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 cursor-pointer">
                <input type="radio" checked readOnly className="mt-0.5 accent-indigo-600" />
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">No shared repository</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Message exchange between SMs, no repository access.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 bg-gray-50/40 border border-gray-200/50 rounded-xl px-4 py-3 opacity-40 cursor-not-allowed">
                <input type="radio" disabled className="mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">Shared project repository
                    <span className="ml-2 text-xs text-gray-600 font-normal">coming soon</span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border-default)] flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !description.trim()}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  )
}
