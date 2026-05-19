interface TopRibbonProps {
  pageName:          string
  pageSubtitle?:     string
  pageSubtitleHref?: string
  projectName?:      string
  userName?:         string
  accentColor?:      string
}

export default function TopRibbon({
  pageName, pageSubtitle, pageSubtitleHref, projectName, userName, accentColor,
}: TopRibbonProps) {
  const rightInfo = [
    projectName ? `Project: ${projectName}` : null,
    userName    ? `User: ${userName}`        : null,
  ].filter(Boolean).join(' · ')

  const colored   = !!accentColor
  const textPrimary   = colored ? '#1e293b' : '#ffffff'
  const textSecondary = colored ? '#475569' : '#9ca3af'

  return (
    <header
      className="sticky top-0 z-50 h-12 px-6 flex items-center justify-between shrink-0"
      style={{
        background:   colored ? accentColor : '#111827',
        borderBottom: colored ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgb(31,41,55)',
      }}
    >

      {/* LEFT — logo + wordmark (clickeable → dashboard) */}
      <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">AI</span>
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: textPrimary }}>AISync</span>
      </a>

      {/* CENTER — page name + subtitle */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: textPrimary }}>
          {pageName}
        </span>
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
            ) : (
              <span className="text-xs leading-none mt-0.5" style={{ color: textSecondary }}>{pageSubtitle}</span>
            )
        )}
      </div>

      {/* RIGHT — project · user */}
      <div className="text-xs" style={{ color: textSecondary }}>
        {rightInfo}
      </div>

    </header>
  )
}
