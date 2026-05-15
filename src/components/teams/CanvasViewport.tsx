'use client'

import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface Props {
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
  fitFloor?: number
  fitTopOffset?: number
  alignTopOnFit?: boolean
  zoomInSignal?: number
  zoomOutSignal?: number
  resetSignal?: number
  children: ReactNode
}

export default function CanvasViewport({
  initialZoom = 1,
  minZoom = 0.05,
  maxZoom = 1.12,
  fitFloor,
  fitTopOffset,
  alignTopOnFit,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
  children,
}: Props) {
  const [zoom, setZoom]           = useState(initialZoom)
  const [isDragging, setIsDragging] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef  = useRef<HTMLDivElement | null>(null)
  const offsetRef   = useRef({ x: 0, y: 0 })
  const pendingRef  = useRef({ x: 0, y: 0 })
  const manualRef   = useRef(false)
  const rafRef      = useRef<number | null>(null)
  const dragRef     = useRef<{
    pointerId: number
    startX: number; startY: number
    originX: number; originY: number
  } | null>(null)

  const applyTransform = () => {
    if (!contentRef.current) return
    const { x, y } = offsetRef.current
    contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`
  }

  const scheduleTransform = () => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      offsetRef.current = { ...pendingRef.current }
      applyTransform()
    })
  }

  const clamp = (z: number) => Math.min(maxZoom, Math.max(minZoom, Number(z.toFixed(2))))

  const zoomAt = (nextZ: number, cx: number, cy: number, manual = true) => {
    const vp = viewportRef.current
    const ct = contentRef.current
    if (!vp || !ct) { setZoom(clamp(nextZ)); return }

    const cz = clamp(nextZ)
    if (cz === zoom) return

    const rect    = ct.getBoundingClientRect()
    const ctW     = Math.max(ct.scrollWidth, ct.offsetWidth, 1)
    const originX = ctW / 2
    const baseL   = rect.left - offsetRef.current.x - originX * (1 - zoom)
    const baseT   = rect.top  - offsetRef.current.y
    const lx      = (cx - rect.left) / zoom
    const ly      = (cy - rect.top)  / zoom
    const next    = {
      x: cx - lx * cz - baseL - originX * (1 - cz),
      y: cy - ly * cz - baseT,
    }

    offsetRef.current = next
    pendingRef.current = next
    if (manual) manualRef.current = true
    setZoom(cz)
  }

  const updateZoom = (nextZ: number, manual = false) => {
    const vp = viewportRef.current
    if (!vp) { setZoom(clamp(nextZ)); return }
    const rect = vp.getBoundingClientRect()
    zoomAt(nextZ, rect.left + rect.width / 2, rect.top + rect.height / 2, manual)
  }

  const fitViewport = () => {
    const vp = viewportRef.current
    const ct = contentRef.current
    if (!vp || !ct) return

    const pad  = window.innerWidth < 640 ? 4 : 8
    const aw   = Math.max(vp.clientWidth  - pad * 2, 1)
    const ah   = Math.max(vp.clientHeight - pad * 2, 1)
    const cw   = Math.max(ct.scrollWidth,  ct.offsetWidth,  1)
    const ch   = Math.max(ct.scrollHeight, ct.offsetHeight, 1)
    const fz   = clamp(Math.max(
      fitFloor ?? minZoom,
      Math.min(initialZoom, aw / cw, ah / ch) * 0.92,
    ))
    const vy = alignTopOnFit
      ? fitTopOffset ?? 0
      : Math.max((ah - ch * fz) / 2, fitTopOffset ?? 0)

    manualRef.current    = false
    offsetRef.current    = { x: 0, y: vy }
    pendingRef.current   = { x: 0, y: vy }
    setZoom(fz)
  }

  const stopDrag = (el?: HTMLDivElement, pid?: number) => {
    if (!dragRef.current) return
    try { if (el && pid !== undefined) el.releasePointerCapture(pid) } catch { /* ignore */ }
    dragRef.current = null
    setIsDragging(false)
  }

  useEffect(() => { applyTransform() }, [zoom])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (zoomInSignal)  updateZoom(zoom + 0.14, true) }, [zoomInSignal])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (zoomOutSignal) updateZoom(zoom - 0.14, true) }, [zoomOutSignal])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (resetSignal)   fitViewport()                 }, [resetSignal])

  useEffect(() => {
    const vp = viewportRef.current
    const ct = contentRef.current
    if (!vp) return

    fitViewport()

    const ro = new ResizeObserver(() => { if (!manualRef.current) fitViewport() })
    ro.observe(vp)
    if (ct) ro.observe(ct)
    return () => ro.disconnect()
  }, [alignTopOnFit, fitFloor, fitTopOffset, initialZoom, maxZoom, minZoom])

  useEffect(() => () => { if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current) }, [])

  return (
    <div
      className="relative overflow-visible rounded-[20px] border"
      style={{
        borderColor: 'rgba(15,23,42,0.12)',
        background: 'linear-gradient(180deg, rgba(232,238,244,0.98) 0%, rgba(223,231,239,0.96) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.08), 0 10px 26px rgba(15,23,42,0.06)',
      }}
    >
      <div
        ref={viewportRef}
        className="relative h-[min(72vh,760px)] min-h-[520px] overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-pan-block="true"],[data-viewport-block="true"]')) return
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX, startY: e.clientY,
            originX: offsetRef.current.x, originY: offsetRef.current.y,
          }
          manualRef.current = true
          setIsDragging(true)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
          pendingRef.current = {
            x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
          }
          scheduleTransform()
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-pan-block="true"],[data-viewport-block="true"]')) {
            e.preventDefault(); e.stopPropagation()
          }
        }}
        onDoubleClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('[data-pan-block="true"],[data-viewport-block="true"]')) {
            e.preventDefault(); e.stopPropagation()
          }
        }}
        onPointerUp={(e)     => stopDrag(e.currentTarget, e.pointerId)}
        onPointerCancel={(e) => stopDrag(e.currentTarget, e.pointerId)}
        onWheel={(e) => {
          if ((e.target as HTMLElement).closest('[data-pan-block="true"],[data-viewport-block="true"]')) return
          e.preventDefault()
          zoomAt(zoom + (e.deltaY < 0 ? 0.08 : -0.08), e.clientX, e.clientY)
        }}
      >
        <div
          className="absolute inset-0 flex items-start justify-center p-3 sm:p-4"
          style={{
            background: 'radial-gradient(circle at top, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(247,250,252,0.74) 0%, rgba(228,235,241,0.42) 100%)',
          }}
        >
          <div
            ref={contentRef}
            className="inline-flex w-max flex-col items-center origin-top"
            style={{
              transform: `translate3d(0px, 0px, 0) scale(${zoom})`,
              transformOrigin: 'top center',
              willChange: 'transform',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
