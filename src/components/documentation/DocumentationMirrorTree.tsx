'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { buildDocumentationMirrorTree, type MirrorTreeInput } from '@/lib/documentation/buildMirrorTree'
import type { DocumentationMirrorNode } from '@/lib/documentation/types'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 2.5L8 6L4 9.5" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 3.25h4l1 1.25h8v7.75H1.5z" />
      <path d="M1.5 4.5h13v-1H6.9L5.9 2.25H1.5z" className="opacity-70" />
    </svg>
  )
}

function TreeViewport({ children, className = '' }: { children: ReactNode; className?: string }) {
  const viewportRef          = useRef<HTMLDivElement | null>(null)
  const dragStateRef         = useRef<{
    pointerId:  number
    startX:     number
    startY:     number
    scrollLeft: number
    scrollTop:  number
  } | null>(null)
  const suppressClickUntilRef = useRef(0)
  const [zoom, setZoom]       = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const clampZoom = (next: number) => Math.min(2.2, Math.max(0.75, Number(next.toFixed(2))))

  return (
    <div
      ref={viewportRef}
      className={`overflow-auto px-3 py-3 ${className}`}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onClickCapture={e => {
        if (Date.now() < suppressClickUntilRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onWheel={e => {
        const vp = viewportRef.current
        if (!vp) return
        e.preventDefault()
        const rect = vp.getBoundingClientRect()
        const px   = e.clientX - rect.left
        const py   = e.clientY - rect.top
        const lx   = (vp.scrollLeft + px) / zoom
        const ly   = (vp.scrollTop  + py) / zoom
        const next = clampZoom(zoom + (e.deltaY < 0 ? 0.12 : -0.12))
        if (next === zoom) return
        setZoom(next)
        window.requestAnimationFrame(() => {
          if (!viewportRef.current) return
          viewportRef.current.scrollLeft = lx * next - px
          viewportRef.current.scrollTop  = ly * next - py
        })
      }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest('button, [data-docs-no-pan="true"]')) return
        dragStateRef.current = {
          pointerId:  e.pointerId,
          startX:     e.clientX,
          startY:     e.clientY,
          scrollLeft: e.currentTarget.scrollLeft,
          scrollTop:  e.currentTarget.scrollTop,
        }
        setIsPanning(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const ds = dragStateRef.current
        if (!ds || ds.pointerId !== e.pointerId) return
        const dx = e.clientX - ds.startX
        const dy = e.clientY - ds.startY
        if (!isPanning && Math.abs(dx) + Math.abs(dy) < 6) return
        if (!isPanning) setIsPanning(true)
        e.currentTarget.scrollLeft = ds.scrollLeft - dx
        e.currentTarget.scrollTop  = ds.scrollTop  - dy
      }}
      onPointerUp={e => {
        if (dragStateRef.current?.pointerId !== e.pointerId) return
        if (isPanning) suppressClickUntilRef.current = Date.now() + 180
        dragStateRef.current = null
        setIsPanning(false)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={e => {
        if (dragStateRef.current?.pointerId !== e.pointerId) return
        dragStateRef.current = null
        setIsPanning(false)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    >
      <div
        className="inline-block min-w-full origin-top-left"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

function MirrorTreeNode({
  node,
  depth,
  openState,
  onToggle,
}: {
  node:      DocumentationMirrorNode
  depth:     number
  openState: Record<string, boolean>
  onToggle:  (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const open        = openState[node.id] ?? depth < 3

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover,rgba(0,0,0,0.04))]"
        onClick={() => hasChildren && onToggle(node.id)}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {hasChildren
          ? <Chevron open={open} />
          : <span className="inline-block w-3" />
        }
        <FolderIcon />
        <span className={node.kind === 'root' ? 'font-semibold text-[var(--color-text-primary)]' : ''}>
          {node.label}
        </span>
        {node.roleLabel && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            {node.roleLabel}
          </span>
        )}
      </button>

      {open && hasChildren && node.children.map(child => (
        <MirrorTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          openState={openState}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

export default function DocumentationMirrorTree({ rootLabel, teams, agents }: MirrorTreeInput) {
  const tree = useMemo(
    () => buildDocumentationMirrorTree({ rootLabel, teams, agents }),
    [rootLabel, teams, agents],
  )
  const [openState, setOpenState] = useState<Record<string, boolean>>({})
  const toggle = (id: string) =>
    setOpenState(prev => ({ ...prev, [id]: !(prev[id] ?? true) }))

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)]">
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between gap-3 border-b border-[var(--color-border-default)]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Documentation Mirror Tree
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            Hierarchical view mirrored from Teams structure.
          </div>
        </div>
        <div className="text-right text-[10px] text-[var(--color-text-muted)]">
          <div>{teams.length} teams</div>
          <div>{agents.length} agents</div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TreeViewport className="h-full">
          <div className="relative border-l border-[var(--color-border-subtle,rgba(0,0,0,0.08))] pl-1">
            <MirrorTreeNode node={tree} depth={0} openState={openState} onToggle={toggle} />
          </div>
        </TreeViewport>
      </div>
    </div>
  )
}
