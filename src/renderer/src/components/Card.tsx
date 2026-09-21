import type { HealthLevel } from '@shared/types'
import { healthLabel } from '@renderer/lib/format'

const tone: Record<HealthLevel, string> = {
  ok: 'bg-accent text-accent-ink',
  warn: 'bg-warn text-accent-ink',
  bad: 'bg-bad text-ink',
  unknown: 'bg-white/8 text-muted',
  pending: 'bg-white/8 text-muted'
}

export function StatusBadge({ level }: { level: HealthLevel }): React.JSX.Element {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone[level]}`}>
      {healthLabel(level)}
    </span>
  )
}

export function Card({
  children,
  className = '',
  accent = false,
  onClick
}: {
  children: React.ReactNode
  className?: string
  accent?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const classes = [
    'rounded-[28px] p-6 overflow-hidden',
    accent
      ? 'bg-accent text-accent-ink'
      : 'bg-surface/72 text-ink ring-1 ring-white/8 backdrop-blur-xl',
    onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : '',
    className
  ].join(' ')

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} text-left`}>
        {children}
      </button>
    )
  }

  return <section className={classes}>{children}</section>
}

export function Kicker({
  children,
  accent = false
}: {
  children: React.ReactNode
  accent?: boolean
}): React.JSX.Element {
  return (
    <p
      className={`text-[11px] font-semibold tracking-[0.18em] uppercase ${
        accent ? 'text-accent-ink/70' : 'text-accent'
      }`}
    >
      {children}
    </p>
  )
}

export function Stat({
  label,
  value,
  hint
}: {
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">{label}</p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[12px] text-muted">{hint}</p> : null}
    </div>
  )
}

export function Skeleton({ className }: { className: string }): React.JSX.Element {
  return <div className={`animate-pulse rounded-2xl bg-white/6 ${className}`} />
}
