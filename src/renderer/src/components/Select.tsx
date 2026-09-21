import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Выберите'
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [maxHeight, setMaxHeight] = useState(208)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!open || !root.current) return
    const trigger = root.current.getBoundingClientRect()
    const clip = root.current.closest('section')?.getBoundingClientRect()
    const pad = 14
    const belowLimit = Math.min(window.innerHeight, clip?.bottom ?? window.innerHeight) - pad
    const aboveLimit = Math.max(0, clip?.top ?? 0) + pad
    const below = belowLimit - trigger.bottom - 8
    const above = trigger.top - aboveLimit - 8
    const shouldUp = below < 132 && above > below
    setOpenUp(shouldUp)
    setMaxHeight(Math.max(96, Math.min(220, shouldUp ? above : below)))
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative z-30 mt-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm outline-none transition-colors ${
          open ? 'bg-white/8 ring-1 ring-accent/40' : 'bg-white/6 hover:bg-white/10'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-ink' : 'text-muted'}`}>
          {selected?.label || placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          className={`absolute right-0 left-0 overflow-hidden rounded-2xl bg-surface/92 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,.45)] ring-1 ring-white/8 backdrop-blur-xl ${
            openUp ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          }`}
        >
          <ul role="listbox" className="menu-scroll" style={{ maxHeight }}>
            {options.length ? (
              options.map((option) => {
                const active = option.value === value
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-accent font-semibold text-accent-ink'
                          : 'text-ink hover:bg-white/6'
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                )
              })
            ) : (
              <li className="px-3 py-2.5 text-sm text-muted">Нет устройств</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
