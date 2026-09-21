import type { TabId } from '@shared/types'
import trajectLogo from '../assets/traject-white.png'

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'network', label: 'Сеть' },
  { id: 'ping', label: 'Пинг' },
  { id: 'audio', label: 'Звук' },
  { id: 'system', label: 'Система' },
  { id: 'display', label: 'Экран' },
  { id: 'zapret', label: 'Обход' }
]

interface TitleBarProps {
  tab: TabId
  onTab: (tab: TabId) => void
}

export function TitleBar({ tab, onTab }: TitleBarProps): React.JSX.Element {
  return (
    <header className="drag-region flex h-12 shrink-0 items-center gap-5">
      <div className="flex shrink-0 items-center">
        <img
          src={trajectLogo}
          alt="TRAJECT"
          className="pointer-events-none h-[15px] w-auto object-contain"
        />
      </div>

      <nav className="flex min-w-0 flex-1 items-center gap-1">
        {tabs.map((item) => {
          const active = item.id === tab
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={`no-drag cursor-pointer ${
                active
                  ? 'rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink'
                  : 'rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted hover:bg-white/5 hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Свернуть"
          onClick={() => window.api.minimize()}
          className="no-drag grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => window.api.close()}
          className="no-drag grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-bad/25 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3l6 6M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
