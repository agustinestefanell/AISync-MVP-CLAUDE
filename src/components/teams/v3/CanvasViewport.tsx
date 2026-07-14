'use client'

/**
 * CanvasViewport — Port literal desde PageD.tsx demo
 *
 * Pan/zoom viewport component con:
 * - Drag con pointer events
 * - Zoom con wheel
 * - Signals para controles externos (zoom in/out/reset)
 * - Auto-fit al resize
 * - data-pan-block para deshabilitar drag en children
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface CanvasViewportProps {
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
}

export function CanvasViewport({
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
}: CanvasViewportProps) {
  const [zoom, setZoom] = useState(initialZoom)
  const [isDragging, setIsDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const pendingOffsetRef = useRef({ x: 0, y: 0 })
  const hasManualViewportInteractionRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const applyTransform = () => {
    if (!contentRef.current) {
      return
    }

    const { x, y } = offsetRef.current
    contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`
  }

  const scheduleTransform = () => {
    if (rafRef.current !== null) {
      return
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      offsetRef.current = { ...pendingOffsetRef.current }
      applyTransform()
    })
  }

  const clampZoom = (nextZoom: number) =>
    Math.min(maxZoom, Math.max(minZoom, Number(nextZoom.toFixed(2))))

  const updateZoomAtClientPoint = (
    nextZoom: number,
    clientX: number,
    clientY: number,
    options?: { markManual?: boolean },
  ) => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) {
      setZoom(clampZoom(nextZoom))
      return
    }

    const clampedZoom = clampZoom(nextZoom)
    if (clampedZoom === zoom) {
      return
    }

    const contentRect = content.getBoundingClientRect()
    const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1)
    const originX = contentWidth / 2
    const baseLeft = contentRect.left - offsetRef.current.x - originX * (1 - zoom)
    const baseTop = contentRect.top - offsetRef.current.y
    const localX = (clientX - contentRect.left) / zoom
    const localY = (clientY - contentRect.top) / zoom
    const nextLeft = clientX - localX * clampedZoom
    const nextTop = clientY - localY * clampedZoom
    const nextOffset = {
      x: nextLeft - baseLeft - originX * (1 - clampedZoom),
      y: nextTop - baseTop,
    }

    offsetRef.current = nextOffset
    pendingOffsetRef.current = nextOffset
    if (options?.markManual ?? true) {
      hasManualViewportInteractionRef.current = true
    }
    setZoom(clampedZoom)
  }

  const updateZoom = (nextZoom: number, options?: { markManual?: boolean }) => {
    const viewport = viewportRef.current
    if (!viewport) {
      setZoom(clampZoom(nextZoom))
      return
    }

    const rect = viewport.getBoundingClientRect()
    updateZoomAtClientPoint(
      nextZoom,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      options,
    )
  }

  const fitViewport = () => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) {
      return
    }

    const padding = window.innerWidth < 640 ? 4 : 8
    const availableWidth = Math.max(viewport.clientWidth - padding * 2, 1)
    const availableHeight = Math.max(viewport.clientHeight - padding * 2, 1)
    const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1)
    const contentHeight = Math.max(content.scrollHeight, content.offsetHeight, 1)
    const fittedZoom = clampZoom(
      Math.max(
        fitFloor ?? minZoom,
        Math.min(initialZoom, availableWidth / contentWidth, availableHeight / contentHeight) * 0.92,
      ),
    )
    const verticalOffset = alignTopOnFit
      ? fitTopOffset ?? 0
      : Math.max((availableHeight - contentHeight * fittedZoom) / 2, fitTopOffset ?? 0)

    hasManualViewportInteractionRef.current = false
    offsetRef.current = { x: 0, y: verticalOffset }
    pendingOffsetRef.current = { x: 0, y: verticalOffset }
    setZoom(fittedZoom)
  }

  const stopDragging = (currentTarget?: HTMLDivElement, pointerId?: number) => {
    if (!dragStateRef.current) {
      return
    }

    try {
      if (currentTarget && pointerId !== undefined) {
        currentTarget.releasePointerCapture(pointerId)
      }
    } catch {
      // Ignore release failures in browsers that already released capture.
    }

    dragStateRef.current = null
    setIsDragging(false)
  }

  useEffect(() => {
    applyTransform()
  }, [zoom])

  // Native wheel listener with { passive: false } to prevent scroll during zoom
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (event: WheelEvent) => {
      // Check if target is inside a pan-block or viewport-block element
      const target = event.target as HTMLElement
      if (target.closest('[data-pan-block="true"], [data-viewport-block="true"]')) {
        return
      }

      // Prevent default scroll behavior and stop propagation
      event.preventDefault()
      event.stopPropagation()

      // Calculate next zoom level
      const nextZoom = zoom + (event.deltaY < 0 ? 0.08 : -0.08)
      updateZoomAtClientPoint(nextZoom, event.clientX, event.clientY, { markManual: true })
    }

    // Register listener with { passive: false } to allow preventDefault()
    viewport.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', handleWheel)
    }
  }, [zoom, updateZoomAtClientPoint])

  useEffect(() => {
    if (!zoomInSignal) {
      return
    }

    updateZoom(zoom + 0.14, { markManual: true })
  }, [zoomInSignal])

  useEffect(() => {
    if (!zoomOutSignal) {
      return
    }

    updateZoom(zoom - 0.14, { markManual: true })
  }, [zoomOutSignal])

  useEffect(() => {
    if (!resetSignal) {
      return
    }

    fitViewport()
  }, [resetSignal])

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport) {
      return
    }

    fitViewport()

    const resizeObserver = new ResizeObserver(() => {
      if (hasManualViewportInteractionRef.current) {
        return
      }
      fitViewport()
    })
    resizeObserver.observe(viewport)
    if (content) {
      resizeObserver.observe(content)
    }

    return () => resizeObserver.disconnect()
  }, [alignTopOnFit, fitFloor, fitTopOffset, initialZoom, maxZoom, minZoom])

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    },
    [],
  )

  return (
    <div
      className="relative overflow-visible rounded-[20px] border shadow-[var(--shadow-soft)]"
      style={{
        borderColor: 'rgba(15, 23, 42, 0.12)',
        background:
          'linear-gradient(180deg, rgba(232, 238, 244, 0.98) 0%, rgba(223, 231, 239, 0.96) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.08), 0 10px 26px rgba(15,23,42,0.06)',
      }}
    >
      <div
        ref={viewportRef}
        className="relative overflow-hidden select-none overscroll-contain"
        style={{
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          height: 'min(82vh, 1200px)',
          minHeight: '600px',
          overscrollBehavior: 'contain',
        }}
        onPointerDown={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            return
          }

          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: offsetRef.current.x,
            originY: offsetRef.current.y,
          }
          hasManualViewportInteractionRef.current = true
          setIsDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
            return
          }

          pendingOffsetRef.current = {
            x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
            y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
          }
          scheduleTransform()
        }}
        onDoubleClick={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onDoubleClickCapture={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
      >
        <div
          className="absolute inset-0 flex items-start justify-center p-3 sm:p-4"
          style={{
            background:
              'radial-gradient(circle at top, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(247,250,252,0.74) 0%, rgba(228,235,241,0.42) 100%)',
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
        {overlay ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  )
}
