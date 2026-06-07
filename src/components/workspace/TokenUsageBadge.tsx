'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  workspaceId?: string | null
}

type UsageRow = {
  provider:      string
  model:         string
  input_tokens:  number
  output_tokens: number
  total_tokens:  number
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function fetchUsage(workspaceId: string, setRows: (r: UsageRow[]) => void) {
  const supabase = createClient()
  supabase
    .from('token_usage')
    .select('provider, model, input_tokens, output_tokens, total_tokens, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) console.error('[token_usage] query failed', error)
      if (data) setRows(data)
    })
}

export default function TokenUsageBadge({ workspaceId }: Props) {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [open, setOpen] = useState(false)

  // Carga inicial al montar
  useEffect(() => {
    if (!workspaceId) return
    fetchUsage(workspaceId, setRows)
  }, [workspaceId])

  // Re-fetch cada vez que el modal se abre — datos frescos
  useEffect(() => {
    if (!open || !workspaceId) return
    fetchUsage(workspaceId, setRows)
  }, [open, workspaceId])

  // Fix 1: guardas separadas — workspaceId ausente vs sin datos son casos distintos
  if (!workspaceId) return null
  if (rows.length === 0) return null

  const grouped = rows.reduce<Record<string, UsageRow>>((acc, r) => {
    const key = `${r.provider}|${r.model}`
    if (!acc[key]) acc[key] = { provider: r.provider, model: r.model, input_tokens: 0, output_tokens: 0, total_tokens: 0 }
    acc[key].input_tokens  += r.input_tokens
    acc[key].output_tokens += r.output_tokens
    acc[key].total_tokens  += r.total_tokens
    return acc
  }, {})
  const groupedRows = Object.values(grouped)
  const totalTokens = groupedRows.reduce((s, r) => s + r.total_tokens, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider leading-none border transition-colors"
        style={{ color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.35)', background: 'transparent' }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.65)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.35)'
        }}
      >
        {formatTokens(totalTokens)} tokens
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Token Usage</h3>
                <p className="text-xs text-gray-500 mt-0.5">This workspace · {formatTokens(totalTokens)} total</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm px-1 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Provider</th>
                    <th className="text-left pb-2 font-medium">Model</th>
                    <th className="text-right pb-2 font-medium">In</th>
                    <th className="text-right pb-2 font-medium">Out</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map(r => (
                    <tr key={`${r.provider}|${r.model}`} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-700 capitalize">{r.provider}</td>
                      <td className="py-1.5 text-gray-500 max-w-[120px] truncate">{r.model}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">{r.input_tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">{r.output_tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium text-gray-900">{r.total_tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
