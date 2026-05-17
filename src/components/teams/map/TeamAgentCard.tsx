'use client'

import type { MapAgentNode } from '@/lib/map/buildAgentLayout'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFamilyColor(color: string, alpha: number): string {
  const normalized = color.replace('#', '').trim()
  if (![3, 6].includes(normalized.length)) return color
  const expanded =
    normalized.length === 3
      ? normalized.split('').map(c => `${c}${c}`).join('')
      : normalized
  const r = parseInt(expanded.slice(0, 2), 16)
  const g = parseInt(expanded.slice(2, 4), 16)
  const b = parseInt(expanded.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── TreeWorkspaceCard (direct port of demo's TreeWorkspaceCard) ──────────────

function TreeWorkspaceCard({
  title,
  subtitle,
  functionLabel,
  brief,
  ribbonColor,
  softColor,
  borderColor,
  accentColor,
  tags,
  compact,
  outlineOnly,
  isSat,
  actionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
}: {
  title: string
  subtitle: string
  functionLabel: string
  brief: string
  ribbonColor: string
  softColor: string
  borderColor: string
  accentColor: string
  tags: string[]
  compact?: boolean
  outlineOnly?: boolean
  isSat?: boolean
  actionLabel: string
  secondaryActionLabel?: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
}) {
  const shellBackground = outlineOnly ? '#ffffff' : ribbonColor
  const shellColor      = outlineOnly ? accentColor : '#ffffff'
  const cardWidth       = compact ? 265 : 300

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[18px] border text-left transition-transform hover:-translate-y-[1px]"
      style={{
        width:     `${cardWidth}px`,
        minWidth:  `${cardWidth}px`,
        borderColor: outlineOnly ? accentColor : borderColor,
        background: outlineOnly
          ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(245,248,251,0.98) 100%)'
          : compact
            ? 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,249,252,0.98) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,252,254,0.98) 100%)',
        boxShadow: compact
          ? '0 10px 20px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.72)'
          : '0 14px 30px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {isSat && (
        <div
          className="absolute right-3 top-3 z-10 rounded-[7px] border px-2 py-1 text-[9px] font-semibold leading-none text-neutral-700"
          style={{
            borderColor: 'rgba(15,23,42,0.18)',
            background:  'rgba(255,255,255,0.96)',
            boxShadow:   '0 3px 8px rgba(15,23,42,0.1)',
          }}
        >
          SAT
        </div>
      )}

      {/* Header */}
      <div
        className="relative shrink-0 px-4 py-3"
        style={{
          background: outlineOnly
            ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,248,251,0.96) 100%)'
            : `linear-gradient(180deg, ${shellBackground} 0%, ${accentColor} 100%)`,
          color:       shellColor,
          borderBottom: `1px solid ${outlineOnly ? borderColor : 'rgba(255,255,255,0.16)'}`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">{subtitle}</div>
        <div className={`mt-1 min-h-[2.8rem] font-semibold ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
          {title}
        </div>
      </div>

      {/* Body */}
      <div className={`flex min-h-0 flex-1 flex-col gap-3 px-4 ${compact ? 'py-4 text-[10px]' : 'py-4 text-[11px]'}`}>
        <div className="grid shrink-0 gap-1.5">
          <div className="text-[12px] font-semibold leading-[1.35] text-neutral-950">{functionLabel}</div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-x-2 gap-y-1 text-[10px] leading-[1.3] text-neutral-500">
          {tags.slice(0, compact ? 3 : 4).map(tag => (
            <span
              key={tag}
              className="rounded-full border px-2 py-1 font-medium"
              style={{ color: accentColor, borderColor, backgroundColor: softColor }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div
          className="min-h-[4.35rem] flex-1 rounded-[12px] px-3.5 py-3 text-[11px] leading-[1.45] text-neutral-700"
          style={{
            border:     `1px solid ${borderColor}`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
          }}
        >
          {brief || <span className="italic text-neutral-400">No description yet.</span>}
        </div>

        {/* Actions */}
        <div
          className={`mt-auto grid shrink-0 gap-2 pt-3 ${secondaryActionLabel ? 'grid-cols-2' : 'grid-cols-1'}`}
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <button
            type="button"
            data-pan-block="true"
            className="min-h-9 rounded-[10px] bg-[#1e293b] px-3 text-[11px] font-medium text-white hover:bg-[#334155]"
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onPrimaryAction() }}
          >
            {actionLabel}
          </button>
          {secondaryActionLabel && (
            <button
              type="button"
              data-pan-block="true"
              className="min-h-9 rounded-[10px] border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onSecondaryAction?.() }}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── GM Card ──────────────────────────────────────────────────────────────────

function GMCard({
  node,
  onOpen,
  onEdit,
}: {
  node: MapAgentNode
  onOpen: () => void
  onEdit: () => void
}) {
  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden rounded-[22px]"
      style={{
        border:     '1.5px solid rgba(15,23,42,0.22)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(244,247,250,0.98) 100%)',
        boxShadow:  '0 18px 38px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.80)',
      }}
    >
      {/* Header — label + name */}
      <div
        className="shrink-0 px-5 pt-2.5 pb-2"
        style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}
      >
        <div className="text-[9px] font-semibold uppercase tracking-[0.20em] text-neutral-500">
          General Manager
        </div>
        <div className="mt-0.5 text-[15px] font-bold leading-tight text-neutral-950 line-clamp-1">
          {node.teamName}
        </div>
      </div>

      {/* Body — info columns + description */}
      <div className="flex flex-1 min-h-0 flex-col gap-2 px-5 py-2">

        {/* Two columns: Provider | Team Type */}
        <div className="flex shrink-0 gap-8">
          <div>
            <div className="text-[8.5px] uppercase tracking-[0.16em] text-neutral-500">Provider</div>
            <div className="mt-0.5 text-[12px] font-semibold leading-tight text-neutral-900">{node.provider}</div>
            <div className="text-[10px] leading-tight text-neutral-500">{node.model}</div>
          </div>
          <div>
            <div className="text-[8.5px] uppercase tracking-[0.16em] text-neutral-500">Team Type</div>
            <div className="mt-0.5 text-[12px] font-semibold leading-tight text-neutral-900">{node.teamType}</div>
            {node.connected
              ? <div className="text-[10px] leading-tight text-emerald-600">Connected</div>
              : <div className="text-[10px] leading-tight text-neutral-400">—</div>
            }
          </div>
        </div>

        {/* Description — full width, fills remaining space */}
        <div
          className="flex-1 min-h-0 rounded-[10px] px-3 py-2 text-[10px] leading-[1.45] text-neutral-700 overflow-hidden"
          style={{
            border:     '1px solid rgba(15,23,42,0.08)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
          }}
        >
          {node.teamDescription || <span className="italic text-neutral-400">No description yet.</span>}
        </div>
      </div>

      {/* Footer — buttons */}
      <div
        className="shrink-0 flex items-center justify-center gap-2 px-5 py-2"
        style={{
          borderTop:  '1px solid rgba(15,23,42,0.08)',
          background: 'linear-gradient(180deg, rgba(247,249,252,0.8) 0%, rgba(239,244,248,0.88) 100%)',
        }}
      >
        <button
          type="button"
          data-pan-block="true"
          className="rounded-[10px] bg-[#1e293b] px-6 py-2 text-[11px] font-medium text-white hover:bg-[#334155]"
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen() }}
        >
          Open Workspace
        </button>
        <button
          type="button"
          data-pan-block="true"
          className="rounded-[10px] border border-neutral-200 bg-white px-5 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// ─── Public: TeamAgentCard — dispatches to GM or TreeWorkspaceCard ────────────

interface Props {
  node:   MapAgentNode
  onOpen: (workspaceId: string) => void
  onEdit: (teamId: string) => void
}

export default function TeamAgentCard({ node, onOpen, onEdit }: Props) {
  const borderColor = getFamilyColor(node.ribbon, 0.35)
  const accentColor = getFamilyColor(node.ribbon, 0.85)

  if (node.type === 'general_manager') {
    return (
      <GMCard
        node={node}
        onOpen={() => onOpen(node.workspaceId)}
        onEdit={() => onEdit(node.teamId)}
      />
    )
  }

  const isWorker    = node.type === 'worker'
  const subtitle    = isWorker ? 'Team Worker' : 'Sub-Team Workspace'
  const functionLabel = node.teamDescription
    ? (isWorker ? 'Execution lane' : 'Team coordination and management')
    : (isWorker ? 'Execution lane' : 'Sub-team coordination')
  const brief       = node.teamDescription ?? ''
  const tags        = [node.provider, node.teamType]

  return (
    <TreeWorkspaceCard
      title={node.teamName}
      subtitle={subtitle}
      functionLabel={functionLabel}
      brief={brief}
      ribbonColor={node.ribbon}
      softColor={node.soft}
      borderColor={borderColor}
      accentColor={accentColor}
      tags={tags}
      compact={isWorker}
      outlineOnly={false}
      isSat={node.teamType === 'SAT'}
      actionLabel="Open"
      secondaryActionLabel="Edit"
      onPrimaryAction={() => onOpen(node.workspaceId)}
      onSecondaryAction={() => onEdit(node.teamId)}
    />
  )
}
