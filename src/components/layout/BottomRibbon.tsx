'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const STATIC_NAV_ITEMS = [
  { label: 'Dashboard',          href: '/',              match: 'exact',     future: false },
  { label: 'Teams Map',          href: '/teams',         match: 'prefix',    future: false },
  { label: 'Audit Log',          href: '/audit',         match: 'prefix',    future: false },
  { label: 'Cross Verification', href: '#',              match: 'prefix',    future: true  },
  { label: 'Documentation Mode', href: '/documentation', match: 'prefix',    future: false },
  { label: 'Prompts Library',    href: '#',              match: 'prefix',    future: true  },
  { label: 'Settings',           href: '/settings',      match: 'prefix',    future: false },
  { label: 'Advanced',           href: '#',              match: 'prefix',    future: true  },
] as const

function isActive(pathname: string, href: string, match: string): boolean {
  if (match === 'exact')     return pathname === href
  if (match === 'workspace') return pathname.startsWith('/workspace')
  return pathname === href || pathname.startsWith(href + '/')
}

export default function BottomRibbon({ accentColor }: { accentColor?: string }) {
  const pathname = usePathname()
  const [workspaceHref, setWorkspaceHref] = useState<string>('/')

  useEffect(() => {
    fetch('/api/active-workspace')
      .then(r => r.json())
      .then(({ workspaceId }: { workspaceId: string | null }) => {
        if (workspaceId) setWorkspaceHref(`/workspace/${workspaceId}`)
      })
      .catch(() => {})
  }, [])

  const NAV_ITEMS = [
    STATIC_NAV_ITEMS[0],                                                            // Dashboard
    STATIC_NAV_ITEMS[1],                                                            // Teams Map
    STATIC_NAV_ITEMS[2],                                                            // Audit Log
    { label: 'Main Workspace', href: workspaceHref, match: 'workspace', future: false } as const,
    ...STATIC_NAV_ITEMS.slice(3),                                                   // rest
  ]

  const colored       = !!accentColor
  const textActive    = '#ffffff'
  const textInactive  = colored ? 'rgba(255,255,255,0.62)' : '#9ca3af'
  const textFuture    = colored ? 'rgba(255,255,255,0.38)' : '#6b7280'
  const textSeparator = colored ? 'rgba(255,255,255,0.18)' : '#374151'

  return (
    <nav
      className="sticky bottom-0 z-50 h-10 flex items-center justify-center shrink-0"
      style={{
        background: colored
          ? `color-mix(in srgb, ${accentColor} 88%, #000)`
          : '#111827',
        borderTop: colored ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgb(31,41,55)',
      }}
    >
      {NAV_ITEMS.map((item, i) => (
        <div key={item.label} className="flex items-center">
          {i > 0 && <span className="text-xs select-none" style={{ color: textSeparator }}>|</span>}

          {item.future ? (
            <span className="relative group cursor-default text-xs px-3 select-none" style={{ color: textFuture }}>
              {item.label}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Coming soon
              </span>
            </span>
          ) : (
            <Link
              href={item.href}
              className="text-xs px-3 transition-colors font-medium"
              style={{
                color: isActive(pathname, item.href, item.match) ? textActive : textInactive,
              }}
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
