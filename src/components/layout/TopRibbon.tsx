interface TopRibbonProps {
  pageName:          string
  pageSubtitle?:     string
  pageSubtitleHref?: string
  projectName?:      string
  userName?:         string
}

export default function TopRibbon({
  pageName, pageSubtitle, pageSubtitleHref, projectName, userName,
}: TopRibbonProps) {
  const rightInfo = [
    projectName ? `Project: ${projectName}` : null,
    userName    ? `User: ${userName}`        : null,
  ].filter(Boolean).join(' · ')

  return (
    <header className="sticky top-0 z-50 h-12 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between shrink-0">

      {/* LEFT — logo + wordmark (clickeable → dashboard) */}
      <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">AI</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-tight">AISync</span>
      </a>

      {/* CENTER — page name + subtitle */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-white text-xs font-bold tracking-widest uppercase">
          {pageName}
        </span>
        {pageSubtitle && (
          pageSubtitleHref
            ? (
              <a
                href={pageSubtitleHref}
                className="text-gray-400 hover:text-white text-xs underline transition-colors leading-none mt-0.5"
              >
                {pageSubtitle}
              </a>
            ) : (
              <span className="text-gray-500 text-xs leading-none mt-0.5">{pageSubtitle}</span>
            )
        )}
      </div>

      {/* RIGHT — project · user */}
      <div className="text-xs text-gray-400">
        {rightInfo}
      </div>

    </header>
  )
}
