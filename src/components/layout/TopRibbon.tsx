import React from 'react'
import HitrLogo from '@/components/branding/HitrLogo'

interface BreadcrumbItem {
  label:            string
  collapsedTooltip?: string
}

// Ajuste ribbon (2026-08-24): con más de 3 niveles, colapsa los intermedios
// detrás de "(...)" — tooltip muestra la cadena COMPLETA (no solo lo oculto),
// Project y el último Sub-Team siempre visibles fuera del colapso.
function buildBreadcrumbItems(segments: string[]): BreadcrumbItem[] {
  if (segments.length <= 3) return segments.map(label => ({ label }))
  const first = segments[0]
  const last = segments[segments.length - 1]
  return [
    { label: first },
    { label: '(...)', collapsedTooltip: segments.join(' / ') },
    { label: last },
  ]
}

interface TopRibbonProps {
  pageName:               string
  pageNameSegments?:      string[]
  pageSubtitle?:          string
  pageSubtitleHref?:      string
  pageSubtitleOnClick?:   () => void
  projectName?:           string
  userName?:              string
  accentColor?:           string
  badge?:                 string
  rightBadge?:            React.ReactNode
}

export default function TopRibbon({
  pageName, pageNameSegments, pageSubtitle, pageSubtitleHref, pageSubtitleOnClick, projectName, userName, accentColor, badge, rightBadge,
}: TopRibbonProps) {
  const rightInfo = [
    projectName ? `Project: ${projectName}` : null,
    userName    ? `User: ${userName}`        : null,
  ].filter(Boolean).join(' · ')

  const colored       = !!accentColor
  const textPrimary   = '#ffffff'
  const textSecondary = colored ? 'rgba(255,255,255,0.68)' : '#9ca3af'

  return (
    <header
      className="sticky top-0 z-50 h-12 px-6 flex items-center justify-between shrink-0"
      style={{
        background:   colored ? accentColor : '#111827',
        borderBottom: colored ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgb(31,41,55)',
      }}
    >

      {/* LEFT — logo + wordmark (clickeable → Teams Map) */}
      <a href="/teams" className="hover:opacity-80 transition-opacity">
        <HitrLogo size="sm" theme="dark" />
      </a>

      {/* CENTER — page name + subtitle */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-center gap-2">
          {pageNameSegments && pageNameSegments.length > 1 ? (
            <span className="text-xs tracking-widest" style={{ color: textPrimary }}>
              {buildBreadcrumbItems(pageNameSegments).map((item, i, items) => {
                const isLast = i === items.length - 1
                return (
                  <span key={i} className={isLast ? 'font-bold' : 'font-light'}>
                    {item.collapsedTooltip ? (
                      <span className="relative group cursor-default">
                        {item.label}
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-gray-700 text-gray-300 text-[11px] font-normal rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {item.collapsedTooltip}
                        </span>
                      </span>
                    ) : item.label}
                    {!isLast && ' / '}
                  </span>
                )
              })}
            </span>
          ) : (
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: textPrimary }}>
              {pageName}
            </span>
          )}
          {badge && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider leading-none border"
              style={
                badge === 'SAT'
                  ? { color: '#000000', borderColor: '#000000', background: '#ffffff' }
                  : { color: '#ffffff', borderColor: '#ffffff', background: '#000000' }
              }
            >
              {badge}
            </span>
          )}
        </div>
        {pageSubtitle && (
          pageSubtitleHref
            ? (
              <a
                href={pageSubtitleHref}
                className="text-xs underline transition-colors leading-none mt-0.5"
                style={{ color: textSecondary }}
              >
                {pageSubtitle}
              </a>
            ) : pageSubtitleOnClick
              ? (
                <button
                  type="button"
                  onClick={pageSubtitleOnClick}
                  className="text-xs underline underline-offset-2 leading-none mt-0.5 transition-opacity hover:opacity-75 cursor-pointer"
                  style={{ color: textSecondary }}
                >
                  {pageSubtitle}
                </button>
              ) : (
                <span className="text-xs leading-none mt-0.5" style={{ color: textSecondary }}>{pageSubtitle}</span>
              )
        )}
      </div>

      {/* RIGHT — rightBadge + project · user */}
      <div className="flex items-center gap-2">
        {rightBadge}
        {rightInfo && (
          <span className="text-xs" style={{ color: textSecondary }}>
            {rightInfo}
          </span>
        )}
      </div>

    </header>
  )
}
