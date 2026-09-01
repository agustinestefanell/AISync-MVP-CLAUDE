import Image from 'next/image'

interface HitrLogoProps {
  size?: 'sm' | 'lg' | 'xl'
  theme?: 'dark' | 'light'
  tagline?: boolean
  className?: string
}

const ICON_SIZE = { sm: 'w-6 h-6', lg: 'w-14 h-14', xl: 'w-20 h-20' }
const ICON_PX = { sm: 24, lg: 56, xl: 80 }
const WORDMARK_SIZE = { sm: 'text-sm', lg: 'text-3xl', xl: 'text-5xl' }
const TAGLINE_SIZE = { sm: 'text-[10px]', lg: 'text-sm', xl: 'text-xl' }

const ROW_GAP = { sm: 'gap-2.5', lg: 'gap-2.5', xl: 'gap-3' }
const TAGLINE_MARGIN = { sm: 'mt-0.5', lg: 'mt-0.5', xl: 'mt-1.5' }

const WORDMARK_COLOR = { dark: '#F4F7FB', light: '#0C1733' }
const TAGLINE_COLOR = { dark: 'rgba(244,247,251,0.68)', light: '#5B6B85' }

export default function HitrLogo({ size = 'lg', theme = 'dark', tagline = false, className = '' }: HitrLogoProps) {
  return (
    <div className={`flex items-center ${ROW_GAP[size]} ${className}`}>
      <Image
        src="/logo/hitr-icon.svg"
        alt=""
        aria-hidden="true"
        width={ICON_PX[size]}
        height={ICON_PX[size]}
        className={`${ICON_SIZE[size]} shrink-0`}
      />
      <div>
        <span
          className={`${WORDMARK_SIZE[size]} font-[family-name:var(--font-inter)] tracking-tight`}
          style={{ color: WORDMARK_COLOR[theme] }}
        >
          <span className="font-bold">Hitr.</span>
          <span className="font-normal">io</span>
        </span>
        {tagline && (
          <p className={`${TAGLINE_SIZE[size]} ${TAGLINE_MARGIN[size]}`} style={{ color: TAGLINE_COLOR[theme] }}>
            Human in the Root
          </p>
        )}
      </div>
    </div>
  )
}
