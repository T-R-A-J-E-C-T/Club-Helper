import { useRef } from 'react'

export function BarSlider({
  value,
  min,
  max,
  step = 0.01,
  onChange
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const fill = max === min ? 0 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  function setFromClientX(clientX: number): void {
    const el = track.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Number(Math.min(max, Math.max(min, snapped)).toFixed(3)))
  }

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className="mt-2 h-2 cursor-pointer rounded-full bg-page-deep outline-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        setFromClientX(event.clientX)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          setFromClientX(event.clientX)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault()
          onChange(Number(Math.max(min, value - step).toFixed(3)))
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault()
          onChange(Number(Math.min(max, value + step).toFixed(3)))
        }
      }}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${fill}%` }} />
    </div>
  )
}
