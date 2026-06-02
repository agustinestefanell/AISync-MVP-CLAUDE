interface TopRibbonProps {
  pageName:               string
  pageSubtitle?:          string
  pageSubtitleHref?:      string
  pageSubtitleOnClick?:   () => void
  projectName?:           string
  userName?:              string
  accentColor?:           string
  badge?:                 string
}

export default function TopRibbon({
  pageName, pageSubtitle, pageSubtitleHref, pageSubtitleOnClick, projectName, userName, accentColor, badge,
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

      {/* LEFT — logo + wordmark (clickeable → dashboard) */}
      <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">AI</span>
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: textPrimary }}>AISync</span>
      </a>

      {/* CENTER — page name + subtitle */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: textPrimary }}>
            {pageName}
          </span>
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

      {/* RIGHT — project · user */}
      <div className="text-xs" style={{ color: textSecondary }}>
        {rightInfo}
      </div>

    </header>
  )
}
