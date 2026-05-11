'use client'

import { useState } from 'react'
import type {
  UserMetrics,
  UsageMetrics,
  SystemMetrics,
  AccountRow,
  SystemPromptRow,
} from '@/lib/db/admin-metrics'

type Section = 'overview' | 'users' | 'prompts' | 'security'

interface AdminEvent {
  id: string
  admin_user_id: string
  action: string
  target_user_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

interface Props {
  userMetrics:   UserMetrics
  usageMetrics:  UsageMetrics
  systemMetrics: SystemMetrics
  accounts:      AccountRow[]
  prompts:       SystemPromptRow[]
  adminEvents:   AdminEvent[]
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewSection({ um, usage, sys }: { um: UserMetrics; usage: UsageMetrics; sys: SystemMetrics }) {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total users"   value={um.total} />
          <MetricCard label="New (7 days)"  value={um.new7d} />
          <MetricCard label="New (30 days)" value={um.new30d} />
          <MetricCard label="Active"        value={um.byStatus['active'] ?? 0} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Roles</h2>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Owner" value={um.byRole['owner'] ?? 0} />
          <MetricCard label="Admin" value={um.byRole['admin'] ?? 0} />
          <MetricCard label="User"  value={um.byRole['user']  ?? 0} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Content</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Checkpoints"  value={usage.totalCheckpoints} />
          <MetricCard label="Audit events" value={usage.totalAuditEvents} />
          <MetricCard label="Projects"     value={sys.totalProjects} />
          <MetricCard label="Teams"        value={sys.totalTeams} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <MetricCard label="Workspaces"      value={sys.totalWorkspaces} />
          <MetricCard label="Agent sessions"  value={sys.totalAgentSessions} />
        </div>
      </div>

      {usage.topProviders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">API keys by provider</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {usage.topProviders.map((p, i) => (
              <div key={p.provider} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                <span className="text-sm text-gray-300">{p.provider}</span>
                <span className="text-sm font-semibold text-white">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── USERS ─────────────────────────────────────────────────────────────────────
function UsersSection({ accounts }: { accounts: AccountRow[] }) {
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(0)
  const PAGE_SIZE = 50

  const filtered = accounts.filter(a =>
    !search || a.email.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const ROLE_CLASS: Record<string, string> = {
    owner: 'text-amber-400 bg-amber-950 border-amber-800',
    admin: 'text-purple-400 bg-purple-950 border-purple-800',
    user:  'text-gray-400 bg-gray-800 border-gray-700',
  }
  const STATUS_CLASS: Record<string, string> = {
    active:    'text-emerald-400 bg-emerald-950 border-emerald-800',
    suspended: 'text-red-400 bg-red-950 border-red-800',
    pending:   'text-yellow-400 bg-yellow-950 border-yellow-800',
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-72"
        />
        <span className="text-xs text-gray-600">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {visible.map(a => (
              <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-gray-200 font-medium">{a.email}</td>
                <td className="px-4 py-3 text-gray-400">{a.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ROLE_CLASS[a.role] ?? ROLE_CLASS.user}`}>
                    {a.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASS[a.status] ?? STATUS_CLASS.active}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500" suppressHydrationWarning>{formatDate(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors px-2 py-1"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-600">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors px-2 py-1"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
function PromptsSection({ prompts }: { prompts: SystemPromptRow[] }) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [baseLayer,    setBaseLayer]    = useState('')
  const [rolePrompt,   setRolePrompt]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  function openEditor(p: SystemPromptRow) {
    setSelectedRole(p.role)
    setBaseLayer(p.base_layer)
    setRolePrompt(p.role_prompt)
    setSaveMsg(null)
  }

  async function handleSave() {
    if (!selectedRole) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/prompts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, base_layer: baseLayer, role_prompt: rolePrompt }),
      })
      if (!res.ok) {
        const body = await res.json()
        setSaveMsg({ ok: false, text: body.error ?? 'Save failed' })
      } else {
        setSaveMsg({ ok: true, text: 'Saved successfully' })
      }
    } catch {
      setSaveMsg({ ok: false, text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  const selected = prompts.find(p => p.role === selectedRole) ?? null

  return (
    <div className="max-w-5xl flex gap-6 h-full">
      {/* Prompt list */}
      <div className="w-56 shrink-0 space-y-1">
        {prompts.map(p => (
          <button
            key={p.role}
            onClick={() => openEditor(p)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
              selectedRole === p.role
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            <p className="font-semibold">{p.display_name}</p>
            <p className="text-xs mt-0.5 opacity-60">{p.role}</p>
          </button>
        ))}
      </div>

      {/* Editor */}
      {selectedRole ? (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">{selected?.display_name}</h3>
              {selected && (
                <p className="text-xs text-gray-600 mt-0.5" suppressHydrationWarning>
                  Last updated: {formatDate(selected.updated_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className={`text-xs ${saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMsg.text}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Layer</label>
            <textarea
              value={baseLayer}
              onChange={e => setBaseLayer(e.target.value)}
              rows={6}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none transition-colors"
            />
          </div>

          <div className="space-y-1.5 flex-1 flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role Prompt</label>
            <textarea
              value={rolePrompt}
              onChange={e => setRolePrompt(e.target.value)}
              rows={12}
              className="flex-1 w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none transition-colors"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-700 text-sm">
          Select a role to edit its prompt
        </div>
      )}
    </div>
  )
}

// ── SECURITY ──────────────────────────────────────────────────────────────────
function SecuritySection({ events }: { events: AdminEvent[] }) {
  const unauthorized = events.filter(e => e.action === 'unauthorized_access')

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">Unauthorized Access Attempts</h2>
        {unauthorized.length > 0 && (
          <span className="text-xs bg-red-950 border border-red-800 text-red-400 px-2 py-0.5 rounded-full font-semibold">
            {unauthorized.length}
          </span>
        )}
      </div>

      {unauthorized.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center">
          <p className="text-gray-600 text-sm">No unauthorized access attempts recorded.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">User ID</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Detail</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {unauthorized.map(e => (
                <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[180px]">{e.admin_user_id}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {(e.payload?.path as string) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600" suppressHydrationWarning>{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminClient({ userMetrics, usageMetrics, systemMetrics, accounts, prompts, adminEvents }: Props) {
  const [section, setSection] = useState<Section>('overview')

  const NAV: { id: Section; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'users',     label: 'Users' },
    { id: 'prompts',   label: 'System Prompts' },
    { id: 'security',  label: 'Security' },
  ]

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col py-6 px-3 gap-1">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setSection(n.id)}
            className={`text-left px-4 py-2.5 rounded-xl text-sm transition-colors font-medium ${
              section === n.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Main area */}
      <main className="flex-1 overflow-y-auto px-8 py-8">
        {section === 'overview'  && <OverviewSection  um={userMetrics} usage={usageMetrics} sys={systemMetrics} />}
        {section === 'users'     && <UsersSection     accounts={accounts} />}
        {section === 'prompts'   && <PromptsSection   prompts={prompts} />}
        {section === 'security'  && <SecuritySection  events={adminEvents} />}
      </main>
    </div>
  )
}
