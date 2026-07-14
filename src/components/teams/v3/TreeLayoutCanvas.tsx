/**
 * TreeLayoutCanvas — Port literal desde PageD.tsx demo
 *
 * Componente que renderiza el canvas de layout con conectores SVG
 * y placements absolutos posicionados
 */

import type { ReactNode } from 'react'
import type {
  TreeLayoutResult,
  TreeLayoutPlacement,
  TreeLayoutConnector,
} from '@/lib/teams/teamsMapLayoutTypes'

function LayoutConnectors({
  connectors,
  width,
  height,
  color,
  strokeWidth,
}: {
  connectors: TreeLayoutConnector[]
  width: number
  height: number
  color: string
  strokeWidth: number
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {connectors.map((connector) => {
        const midpointY = connector.fromY + (connector.toY - connector.fromY) / 2
        const path = [
          `M ${connector.fromX} ${connector.fromY}`,
          `V ${midpointY}`,
          `H ${connector.toX}`,
          `V ${connector.toY}`,
        ].join(' ')

        return (
          <path
            key={`${connector.parentId}_${connector.childId}`}
            d={path}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        )
      })}
    </svg>
  )
}

export function TreeLayoutCanvas({
  layout,
  paddingX,
  paddingY,
  connectorColor,
  connectorStrokeWidth,
  children,
}: {
  layout: TreeLayoutResult
  paddingX: number
  paddingY: number
  connectorColor: string
  connectorStrokeWidth: number
  children: (placement: TreeLayoutPlacement) => ReactNode
}) {
  const width = layout.width + paddingX * 2
  const height = layout.height + paddingY * 2

  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      <LayoutConnectors
        connectors={layout.connectors.map((connector) => ({
          ...connector,
          fromX: connector.fromX + paddingX,
          fromY: connector.fromY + paddingY,
          toX: connector.toX + paddingX,
          toY: connector.toY + paddingY,
        }))}
        width={width}
        height={height}
        color={connectorColor}
        strokeWidth={connectorStrokeWidth}
      />

      {layout.placements.map((placement) => (
        <div
          key={placement.node.id}
          className="absolute"
          style={{
            left: `${placement.x + paddingX}px`,
            top: `${placement.y + paddingY}px`,
            width: `${placement.width}px`,
            height: `${placement.height}px`,
          }}
        >
          {children(placement)}
        </div>
      ))}
    </div>
  )
}
