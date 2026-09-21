export function Toggle({
  on,
  disabled,
  onChange,
  invert = false
}: {
  on: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
  invert?: boolean
}): React.JSX.Element {
  const trackOn = invert ? 'bg-accent-ink' : 'bg-accent'
  const knobOn = invert ? 'right-1 bg-accent' : 'right-1 bg-accent-ink'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-10 w-[68px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? trackOn : 'bg-page-deep'
      }`}
    >
      <span
        className={`absolute top-1 h-8 w-8 rounded-full transition-all ${
          on ? `left-auto ${knobOn}` : 'left-1 bg-muted'
        }`}
      />
    </button>
  )
}
