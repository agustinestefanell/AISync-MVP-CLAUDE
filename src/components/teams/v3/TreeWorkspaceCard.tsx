/**
 * TreeWorkspaceCard — Port literal desde PageD.tsx demo
 *
 * Card component para Teams Map con dos variantes:
 * - Compact (Workers)
 * - Full (Managers/Submanagers)
 */

import type { ReactNode } from 'react'
import { MAP_NODE_WIDTH, MAP_WORKER_WIDTH } from '@/lib/teams/teamsMapLayoutTypes'

export type MapCardMetric = {
  label: string
  value: string
}

export function TreeWorkspaceCard({
  title,
  titleContent,
  subtitle,
  functionLabel,
  brief,
  ribbonColor,
  softColor,
  borderColor,
  accentColor,
  tags,
  metrics,
  compact,
  outlineOnly,
  isSat,
  active,
  isConnected,
  connectionRole,
  partnerEmail,
  partnerOrg,
  actionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  explicitWidth,
}: {
  title: string
  titleContent?: ReactNode
  subtitle: string
  functionLabel: string
  brief: string
  ribbonColor: string
  softColor: string
  borderColor: string
  accentColor: string
  tags: string[]
  metrics: MapCardMetric[]
  compact?: boolean
  outlineOnly?: boolean
  isSat?: boolean
  actionLabel: string
  secondaryActionLabel?: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
  active?: boolean
  isConnected?: boolean // Connected/shared team visual marker
  connectionRole?: 'host' | 'invitee'
  partnerEmail?: string
  partnerOrg?: string
  explicitWidth?: number // Override default width calculation
}) {
  const shellBackground = outlineOnly ? '#ffffff' : ribbonColor
  const shellColor = outlineOnly ? accentColor : '#ffffff'
  const cardWidth = explicitWidth ?? (compact ? MAP_WORKER_WIDTH : MAP_NODE_WIDTH)
  const hasMetrics = metrics.length > 0
  const cardBackground = outlineOnly
    ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(245,248,251,0.98) 100%)'
    : compact
      ? 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,249,252,0.98) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,252,254,0.98) 100%)'

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[18px] text-left shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px]"
      style={{
        width: `${cardWidth}px`,
        minWidth: `${cardWidth}px`,
        border: isConnected ? `3px solid #000000` : `1px solid ${outlineOnly ? accentColor : borderColor}`,
        background: cardBackground,
        boxShadow:
          compact
          ? '0 10px 20px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.72)'
          : '0 14px 30px rgba(15, 23, 42, 0.09), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {isConnected ? (
        <div
          className="w-full px-4 py-2.5 text-[11px] font-semibold leading-tight text-white"
          style={{
            background: '#000000',
          }}
        >
          SHARED TEAM — {connectionRole === 'host' ? 'Host' : 'Invitee'} connection with{' '}
          {partnerEmail || 'unknown@example.com'}
          {partnerOrg ? ` (${partnerOrg})` : ''}
        </div>
      ) : null}
      {isSat && !isConnected ? (
        <div
          className="absolute right-3 top-3 z-10 rounded-[7px] border px-2 py-1 text-[9px] font-semibold leading-none text-neutral-700"
          style={{
            borderColor: 'rgba(15, 23, 42, 0.18)',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 3px 8px rgba(15,23,42,0.1)',
          }}
        >
          SAT
        </div>
      ) : null}
      <div
        className="relative shrink-0 px-4 py-3"
        style={{
          background: outlineOnly
            ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,248,251,0.96) 100%)'
            : `linear-gradient(180deg, ${shellBackground} 0%, ${accentColor} 100%)`,
          color: shellColor,
          borderBottom: `1px solid ${outlineOnly ? borderColor : 'rgba(255,255,255,0.16)'}`,
        }}
      >
        {active ? (
          <span
            className="absolute right-3 top-3 rounded-full px-2 py-1 text-[9px] font-semibold text-emerald-900"
            style={{
              background: 'rgba(236, 253, 245, 0.95)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            Active
          </span>
        ) : null}
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">{subtitle}</div>
        <div className={`mt-1 min-h-[2.8rem] font-semibold ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
          {titleContent ?? title}
        </div>
      </div>

      <div
        className={`flex flex-col gap-3 px-4 ${compact ? 'py-4 text-[10px]' : 'py-4 text-[11px]'}`}
      >
        <div className="shrink-0">
          <div className="text-[12px] font-semibold leading-[1.35] text-neutral-950">{functionLabel}</div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[10px]">
          {tags.slice(0, compact ? 3 : 4).map((tag) => (
            <span
              key={`${title}_${tag}`}
              className="rounded-full border px-2 py-1 font-medium"
              style={{
                color: accentColor,
                borderColor: borderColor,
                backgroundColor: softColor,
              }}
            >
              {tag}
            </span>
          ))}
          {hasMetrics && metrics.map((metric) => (
            <span
              key={`${title}_${metric.label}`}
              className="rounded-full border px-2 py-1 font-semibold text-neutral-700"
              style={{
                borderColor: borderColor,
                backgroundColor: softColor,
              }}
            >
              {metric.label}: {metric.value}
            </span>
          ))}
        </div>

        <div
          className="min-h-[4rem] rounded-[12px] px-3.5 py-3 text-[11px] leading-[1.45] text-neutral-700"
          style={{
            border: `1px solid ${borderColor}`,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
          }}
        >
          {brief}
        </div>

        <div
          className={`mt-auto grid shrink-0 gap-2 pt-3 ${
            secondaryActionLabel ? 'grid-cols-2' : 'grid-cols-1'
          }`}
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <button
            type="button"
            data-pan-block="true"
            className="ui-button ui-button-primary min-h-9 px-3 text-[11px] text-white"
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onPrimaryAction()
            }}
          >
            {actionLabel}
          </button>
          {secondaryActionLabel && (
            <button
              type="button"
              data-pan-block="true"
              className="ui-button min-h-9 px-3 text-[11px] font-medium text-neutral-700"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSecondaryAction?.()
              }}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
