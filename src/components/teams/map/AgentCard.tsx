'use client'

import type { MapAgentNode } from '@/lib/map/buildAgentLayout'

function getFamilyColor(hex: string, alpha: number): string {
  const n = hex.replace('#', '').trim()
  if (![3, 6].includes(n.length)) return hex
  const e = n.length === 3 ? n.split('').map(c => `${c}${c}`).join('') : n
  const r = parseInt(e.slice(0, 2), 16)
  const g = parseInt(e.slice(2, 4), 16)
  const b = parseInt(e.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const PROVIDER_COLOR: Record<string, { text: string; bg: string }> = {
  Anthropic: { text: '#c2410c', bg: 'rgba(194,65,12,0.10)'  },
  OpenAI:    { text: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },
  Google:    { text: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },
  Groq:      { text: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
}

interface Props {
  node: MapAgentNode
  onOpen: (workspaceId: string) => void
  onEdit: (teamId: string) => void
}

export default function AgentCard({ node, onOpen, onEdit }: Props) {
  const { type, label, provider, model, workspaceId, teamId, teamType, teamDescription, ribbon, soft, connected } = node
  const pc          = PROVIDER_COLOR[provider]
  const borderColor = getFamilyColor(ribbon, 0.35)

  // ── General Manager card (760 × 212) ─────────────────────────────────────
  if (type === 'general_manager') {
    return (
      <div
        className="relative flex flex-col overflow-hidden rounded-[24px] border"
        style={{
          width: '760px', height: '212px',
          borderColor: 'rgba(15,23,42,0.18)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,250,0.98) 100%)',
          boxShadow: '0 18px 38px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.76)',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-6 py-4 text-white"
          style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #172235 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">General Manager</div>
          <div className="mt-1 text-[19px] font-semibold">{label}</div>
        </div>

        {/* Body */}
        <div className="flex flex-1 items-center gap-4 px-6 py-4">
          <div className="flex flex-1 gap-3">
            <div
              className="flex flex-col justify-center rounded-[14px] border px-4 py-3 min-w-[160px]"
              style={{ borderColor, backgroundColor: soft }}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold" style={{ color: ribbon }}>Provider</div>
              <div className="mt-1.5 text-[13px] font-semibold text-neutral-900">{provider}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{model}</div>
            </div>
            <div
              className="flex flex-col justify-center rounded-[14px] border px-4 py-3 min-w-[120px]"
              style={{ borderColor, backgroundColor: soft }}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold" style={{ color: ribbon }}>Team Type</div>
              <div className="mt-1.5 text-[13px] font-semibold text-neutral-900">
                {teamType === 'isolated' ? 'Shared Session' : teamType}
              </div>
              {connected && <div className="mt-0.5 text-[11px] text-emerald-600">Connected</div>}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              data-pan-block="true"
              className="rounded-[10px] bg-[#1e293b] px-5 py-2 text-[12px] font-medium text-white hover:bg-[#334155]"
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen(workspaceId) }}
            >
              Open
            </button>
            <button
              type="button"
              data-pan-block="true"
              className="rounded-[10px] border border-neutral-200 bg-white px-5 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(teamId) }}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Senior Manager (356 × 364) and Worker (316 × 312) cards ──────────────
  const isWorker = type === 'worker'
  const W        = isWorker ? 316 : 356
  const H        = isWorker ? 312 : 364

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[18px] border text-left"
      style={{
        width: `${W}px`, height: `${H}px`,
        borderColor: isWorker ? ribbon : borderColor,
        background: isWorker
          ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(245,248,251,0.98) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,252,254,0.98) 100%)',
        boxShadow: isWorker
          ? '0 10px 20px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.72)'
          : '0 14px 30px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{
          background: isWorker
            ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,248,251,0.96) 100%)'
            : `linear-gradient(180deg, ${ribbon} 0%, ${getFamilyColor(ribbon, 0.85)} 100%)`,
          color: isWorker ? ribbon : '#ffffff',
          borderBottom: `1px solid ${isWorker ? borderColor : 'rgba(255,255,255,0.16)'}`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">
          {isWorker ? 'Worker' : 'Senior Manager'}
        </div>
        <div className={`mt-1 font-semibold min-h-[2.8rem] ${isWorker ? 'text-[12px]' : 'text-[14px]'}`}>
          {label}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5 text-[11px]">
        {/* Badges */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {pc ? (
            <span
              className="rounded-full border px-2 py-1 text-[10px] font-medium"
              style={{ color: pc.text, backgroundColor: pc.bg, borderColor: `${pc.text}30` }}
            >
              {provider}
            </span>
          ) : (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-medium text-neutral-600">
              {provider}
            </span>
          )}
          <span
            className="rounded-full border px-2 py-1 text-[10px] font-semibold"
            style={{
              color:      teamType === 'SAT' ? '#0f766e' : teamType === 'isolated' ? '#ffffff' : '#7c3aed',
              background: teamType === 'SAT' ? 'rgba(15,118,110,0.10)' : teamType === 'isolated' ? '#000000' : 'rgba(124,58,237,0.10)',
              borderColor: teamType === 'SAT' ? 'rgba(15,118,110,0.25)' : teamType === 'isolated' ? '#000000' : 'rgba(124,58,237,0.25)',
            }}
          >
            {teamType === 'isolated' ? 'Shared Session' : teamType}
          </span>
          {connected && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
              Connected
            </span>
          )}
        </div>

        {/* Model */}
        <div className="shrink-0 text-[11px] text-neutral-500">{model}</div>

        {/* Description */}
        <div
          className="flex-1 rounded-[12px] px-3.5 py-3 text-[11px] leading-[1.45] text-neutral-700 overflow-hidden"
          style={{
            border: `1px solid ${borderColor}`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
            display: '-webkit-box',
            WebkitLineClamp: isWorker ? 3 : 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {teamDescription || <span className="italic text-neutral-400">No description yet.</span>}
        </div>

        {/* Actions */}
        <div
          className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <button
            type="button"
            data-pan-block="true"
            className="min-h-9 rounded-[10px] bg-[#1e293b] px-3 text-[11px] font-medium text-white hover:bg-[#334155]"
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen(workspaceId) }}
          >
            Open
          </button>
          <button
            type="button"
            data-pan-block="true"
            className="min-h-9 rounded-[10px] border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(teamId) }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
