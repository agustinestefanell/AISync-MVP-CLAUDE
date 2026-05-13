import TopRibbon from './TopRibbon'
import BottomRibbon from './BottomRibbon'

interface AppLayoutProps {
  pageName:           string
  pageSubtitle?:      string
  pageSubtitleHref?:  string
  children:           React.ReactNode
  userName?:          string
  projectName?:       string
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
  scrollable = true,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopRibbon
        pageName={pageName}
        pageSubtitle={pageSubtitle}
        pageSubtitleHref={pageSubtitleHref}
        userName={userName}
        projectName={projectName}
      />
      <main className={
        scrollable
          ? 'flex-1 overflow-auto'
          : 'flex-1 min-h-0 flex flex-col overflow-hidden'
      }>
        {children}
      </main>
      <BottomRibbon />
    </div>
  )
}
