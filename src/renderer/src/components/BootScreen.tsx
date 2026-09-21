import { useEffect } from 'react'
import trajectLogo from '../assets/traject-white.png'

export function BootScreen({
  open,
  onGone
}: {
  open: boolean
  onGone: () => void
}): React.JSX.Element {
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(onGone, 500)
    return () => window.clearTimeout(timer)
  }, [open, onGone])

  return (
    <div
      className={`boot-screen drag-region ${open ? 'boot-screen-in' : 'boot-screen-out'}`}
      aria-busy={open}
    >
      <div className="absolute top-5 right-7 flex items-center gap-1">
        <button
          type="button"
          aria-label="Свернуть"
          onClick={() => window.api.minimize()}
          className="no-drag grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => window.api.close()}
          className="no-drag grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bad/25 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="boot-spinner" />
        <img src={trajectLogo} alt="TRAJECT" className="h-[15px] w-auto object-contain" />
      </div>
    </div>
  )
}
