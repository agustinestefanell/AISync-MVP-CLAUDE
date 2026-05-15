'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function CanvasViewport({
  initialZoom,
  minZoom,
  maxZoom,
  fitFloor,
  fitTopOffset,
  alignTopOnFit,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
  contentWidthClass,
  overlay,
  children,
}: {
  initialZoom: number
  minZoom: number
  maxZoom: number
  fitFloor?: number
  fitTopOffset?: number
  alignTopOnFit?: boolean
  zoomInSignal?: number
  zoomOutSignal?: number
  resetSignal?: number
  contentWidthClass: string
  overlay?: ReactNode
  children: ReactNode
}) {
  const [zoom, setZoom]         = useState(initialZoom)
  const [isDragging, setIsDragging] = useState(false)

  const viewportRef   = useRef<HTMLDivElement | null>(null)
  const contentRef    = useRef<HTMLDivElement | null>(null)
  const offsetRef     = useRef({ x: 0, y: 0 })
  const pendingRef    = useRef({ x: 0, y: 0 })
  const manualRef     = useRef(false)
  const rafRef        = useRef<number | null>(null)
  const dragRef       = useRef<{
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

  const clampZoom = (z: number) => Math.min(maxZoom, Math.max(minZoom, Number(z.toFixed(2))))

  const updateZoomAtClientPoint = (
    nextZoom: number,
    clientX: number,
    clientY: number,
    options?: { markManual?: boolean },
  ) => {
    const viewport = viewportRef.current
    const content  = contentRef.current
    if (!viewport || !content) { setZoom(clampZoom(nextZoom)); return }

    const cz = clampZoom(nextZoom)
    if (cz === zoom) return

    const contentRect  = content.getBoundingClientRect()
    const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1)
    const originX      = contentWidth / 2
    const baseLeft     = contentRect.left - offsetRef.current.x - originX * (1 - zoom)
    const baseTop      = contentRect.top  - offsetRef.current.y
    const localX       = (clientX - contentRect.left) / zoom
    const localY       = (clientY - contentRect.top)  / zoom
    const next = {
      x: clientX - localX * cz - baseLeft - originX * (1 - cz),
      y: clientY - localY * cz - baseTop,
    }

    offsetRef.current = next
    pendingRef.current = next
    if (options?.markManual ?? true) manualRef.current = true
    setZoom(cz)
  }

  const updateZoom = (nextZoom: number, options?: { markManual?: boolean }) => {
    const viewport = viewportRef.current
    if (!viewport) { setZoom(clampZoom(nextZoom)); return }
    const rect = viewport.getBoundingClientRect()
    updateZoomAtClientPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2, options)
  }

  const fitViewport = () => {
    const viewport = viewportRef.current
    const content  = contentRef.current
    if (!viewport || !content) return

    const padding       = window.innerWidth < 640 ? 4 : 8
    const availableW    = Math.max(viewport.clientWidth  - padding * 2, 1)
    const availableH    = Math.max(viewport.clientHeight - padding * 2, 1)
    const contentW      = Math.max(content.scrollWidth,  content.offsetWidth,  1)
    const contentH      = Math.max(content.scrollHeight, content.offsetHeight, 1)
    const fittedZoom    = clampZoom(Math.max(
      fitFloor ?? minZoom,
      Math.min(initialZoom, availableW / contentW, availableH / contentH) * 0.92,
    ))
    const verticalOffset = alignTopOnFit
      ? fitTopOffset ?? 0
      : Math.max((availableH - contentH * fittedZoom) / 2, fitTopOffset ?? 0)

    manualRef.current  = false
    offsetRef.current  = { x: 0, y: verticalOffset }
    pendingRef.current = { x: 0, y: verticalOffset }
    setZoom(fittedZoom)
  }

  const stopDragging = (el?: HTMLDivElement, pointerId?: number) => {
    if (!dragRef.current) return
    try { if (el && pointerId !== undefined) el.releasePointerCapture(pointerId) } catch { /* ignore */ }
    dragRef.current = null
    setIsDragging(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyTransform() }, [zoom])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (zoomInSignal)  updateZoom(zoom + 0.14, { markManual: true }) }, [zoomInSignal])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (zoomOutSignal) updateZoom(zoom - 0.14, { markManual: true }) }, [zoomOutSignal])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (resetSignal)   fitViewport() }, [resetSignal])

  useEffect(() => {
    const viewport = viewportRef.current
    const content  = contentRef.current
    if (!viewport) return

    fitViewport()

    const ro = new ResizeObserver(() => { if (!manualRef.current) fitViewport() })
    ro.observe(viewport)
    if (content) ro.observe(content)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        onPointerUp={(e)     => stopDragging(e.currentTarget, e.pointerId)}
        onPointerCancel={(e) => stopDragging(e.currentTarget, e.pointerId)}
        onWheel={(e) => {
          if ((e.target as HTMLElement).closest('[data-pan-block="true"],[data-viewport-block="true"]')) return
          e.preventDefault()
          updateZoomAtClientPoint(zoom + (e.deltaY < 0 ? 0.08 : -0.08), e.clientX, e.clientY, { markManual: true })
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
            className={`${contentWidthClass} origin-top`}
            style={{ transform: `translate3d(0px, 0px, 0) scale(${zoom})`, transformOrigin: 'top center', willChange: 'transform' }}
          >
            {children}
          </div>
        </div>
        {overlay && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {overlay}
          </div>
        )}
      </div>
    </div>
  )
}
