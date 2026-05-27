import TopRibbon from './TopRibbon'
import BottomRibbon from './BottomRibbon'

interface AppLayoutProps {
  pageName:           string
  pageSubtitle?:      string
  pageSubtitleHref?:  string
  children:           React.ReactNode
  userName?:          string
  projectName?:       string
  accentColor?:       string
  badge?:             string
  /** false = flex column, overflow-hidden (workspace / full-height views) */
  scrollable?:        boolean
}

export default function AppLayout({
  pageName,
  pageSubtitle,
  pageSubtitleHref,
  children,
  userName,
  projectName,
  accentColor,
  badge,
  scrollable = true,
}: AppLayoutProps) {
  return (
    <div
      className={scrollable ? 'min-h-screen flex flex-col' : 'h-screen flex flex-col overflow-hidden'}
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TopRibbon
        pageName={pageName}
        pageSubtitle={pageSubtitle}
        pageSubtitleHref={pageSubtitleHref}
        userName={userName}
        projectName={projectName}
        accentColor={accentColor}
        badge={badge}
      />
      <main className={
        scrollable
          ? 'flex-1 overflow-auto'
          : 'flex-1 overflow-hidden min-h-0 flex flex-col'
      }>
        {children}
      </main>
      <BottomRibbon accentColor={accentColor} />
    </div>
  )
}
