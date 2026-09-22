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

      <div className="flex shrink-0 items-center gap-7">
        <button
          type="button"
          aria-label="Настройки"
          onClick={() => onTab('settings')}
          className={`no-drag grid h-8 w-8 cursor-pointer place-items-center rounded-full ${
            tab === 'settings' ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-white/8 hover:text-ink'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.7 2.4h4.6l.5 2.2c.7.25 1.35.64 1.9 1.12l2.05-.85 2.3 4-1.55 1.55c.1.5.15 1.02.15 1.55s-.05 1.05-.15 1.55l1.55 1.55-2.3 4-2.05-.85c-.55.48-1.2.87-1.9 1.12l-.5 2.2H9.7l-.5-2.2a6.9 6.9 0 0 1-1.9-1.12l-2.05.85-2.3-4 1.55-1.55a7.6 7.6 0 0 1 0-3.1L2.95 8.87l2.3-4 2.05.85c.55-.48 1.2-.87 1.9-1.12l.5-2.2ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"
            />
          </svg>
        </button>
        <div className="flex items-center gap-1">
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
      </div>
    </header>
  )
}
