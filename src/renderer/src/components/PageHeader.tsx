import { Kicker } from '@renderer/components/Card'

export function PageHeader({
  kicker,
  title,
  actions
}: {
  kicker: string
  title: string
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-end justify-between gap-6">
      <div className="min-w-0">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-2.5 truncate text-[40px] leading-[0.92] font-semibold tracking-tight">{title}</h1>
      </div>
      {actions ? <div className="mb-1 flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
