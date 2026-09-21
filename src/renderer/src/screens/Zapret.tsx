import { useState } from 'react'
import { Card, Kicker } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { Toggle } from '@renderer/components/Toggle'
import { useZapret } from '@renderer/context/ZapretContext'
import type { ZapretStrategy } from '@shared/types'

const headerChip =
  'inline-flex items-center rounded-full bg-page/55 px-3.5 py-2 text-[13px] leading-none backdrop-blur-md ring-1 ring-white/8'

export function ZapretScreen(): React.JSX.Element {
  const {
    state,
    busy,
    downloadPercent,
    error,
    selected,
    setSelected,
    download,
    start,
    stop,
    uninstall,
    toggleGameFilter
  } = useZapret()
  const [confirmRemove, setConfirmRemove] = useState(false)

  const running = Boolean(state?.running)
  const ready = Boolean(state?.ready)
  const present = Boolean(state?.present)
  const strategies = state?.strategies ?? []
  const { recommended, alts, fakeTls, simpleFake, other } = splitStrategies(strategies)
  const current = strategies.find((item) => item.file === selected)
  const liveFile = withBat(state?.activeStrategy) || state?.strategy || selected
  const live = strategies.find((item) => item.file === liveFile) ?? current

  async function remove(): Promise<void> {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    await uninstall()
    setConfirmRemove(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        kicker="Обход"
        title="Discord и YouTube"
        actions={
          <>
            {state?.version ? (
              <span className={`${headerChip} text-muted`}>Flowseal {state.version}</span>
            ) : null}
            {ready || present ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void window.api.revealZapretFolder()}
                  className={`${headerChip} text-muted hover:bg-white/8 hover:text-ink disabled:opacity-40`}
                >
                  Показать в папке
                </button>
                {ready ? (
                  <button
                    type="button"
                    disabled={busy || running}
                    onClick={() => void download()}
                    className={`${headerChip} text-muted hover:bg-white/8 hover:text-ink disabled:opacity-40`}
                  >
                    {busy && downloadPercent != null ? `Обновление ${downloadPercent}%` : 'Обновить файлы'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  onBlur={() => {
                    if (!busy) setConfirmRemove(false)
                  }}
                  className={`${headerChip} text-bad hover:bg-bad/15 hover:text-ink disabled:opacity-40`}
                >
                  {busy && confirmRemove ? 'Удаляем…' : confirmRemove ? 'Точно удалить?' : 'Удалить с ПК'}
                </button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-4">
        <div className="flex min-h-0 flex-col gap-4">
          <Card accent={running} className="flex min-h-0 flex-[1.35] flex-col">
            <Kicker accent={running}>Статус</Kicker>
            <p className="mt-6 text-[44px] leading-none font-semibold tracking-tight">
              {running ? 'Включён' : ready ? 'Выключен' : 'Не установлен'}
            </p>
            {running || ready ? (
              <p className={`mt-3 text-[15px] ${running ? 'text-accent-ink/70' : 'text-muted'}`}>
                {running
                  ? live
                    ? heading(live)
                    : strategyTitle(state?.activeStrategy || state?.strategy)
                  : 'Обход не активен на этом ПК'}
              </p>
            ) : null}
            <div className="mt-auto pt-8">
              {!ready ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void download()}
                  className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
                >
                  {busy
                    ? downloadPercent != null
                      ? `Скачиваем… ${downloadPercent}%`
                      : 'Скачиваем…'
                    : 'Скачать zapret'}
                </button>
              ) : running ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void stop()}
                  className="rounded-full bg-accent-ink px-5 py-2.5 text-[13px] font-semibold text-accent disabled:opacity-60"
                >
                  {busy ? 'Выключаем…' : 'Выключить'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => void start()}
                  className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
                >
                  {busy ? 'Включаем…' : 'Включить обход'}
                </button>
              )}
            </div>
            {!ready && busy && downloadPercent != null ? (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-page-deep">
                <div
                  className="meter-fill h-full rounded-full bg-accent"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>
            ) : null}
          </Card>

          <Card className="flex-1">
            <div className="flex h-full items-center justify-between gap-4">
              <div>
                <Kicker>Режим</Kicker>
                <p className="mt-3 text-[22px] font-semibold tracking-tight">Игровой фильтр</p>
              </div>
              <Toggle
                on={Boolean(state?.gameFilter)}
                disabled={!ready || busy}
                onChange={(value) => void toggleGameFilter(value)}
              />
            </div>
            {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Kicker>Стратегия</Kicker>
              <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight">
                {current ? heading(current) : live ? heading(live) : 'Выберите вариант'}
              </p>
            </div>
            {running && selected && selected !== withBat(state?.activeStrategy) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void start()}
                className="rounded-full bg-white/8 px-4 py-2 text-[13px] font-medium hover:bg-white/12 disabled:opacity-60"
              >
                Применить
              </button>
            ) : null}
          </div>

          <div className="menu-scroll mt-5 min-h-0 flex-1 space-y-5 pl-[2px] -ml-[2px] pr-1">
            {recommended.length ? (
              <section>
                <GroupTitle>Рекомендуем</GroupTitle>
                <div className="grid grid-cols-2 gap-2">
                  {recommended.map((item) => (
                    <StrategyTile
                      key={item.file}
                      label={item.label}
                      active={item.file === selected}
                      onSelect={() => setSelected(item.file)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {alts.length ? (
              <section>
                <GroupTitle>ALT</GroupTitle>
                <div className="grid grid-cols-6 gap-2">
                  {alts.map((item) => {
                    const active = item.file === selected
                    return (
                      <button
                        key={item.file}
                        type="button"
                        onClick={() => setSelected(item.file)}
                        className={`h-10 rounded-2xl text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-accent font-semibold text-accent-ink'
                            : 'bg-white/6 text-ink ring-1 ring-inset ring-white/8 hover:bg-white/10'
                        }`}
                      >
                        {altNumber(item)}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {fakeTls.length || simpleFake.length ? (
              <div className={`grid gap-4 ${fakeTls.length && simpleFake.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {fakeTls.length ? (
                  <section>
                    <GroupTitle>Fake TLS</GroupTitle>
                    <div className="flex flex-col gap-1.5">
                      {fakeTls.map((item) => (
                        <StrategyLine
                          key={item.file}
                          label={familyLabel(item)}
                          active={item.file === selected}
                          onSelect={() => setSelected(item.file)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
                {simpleFake.length ? (
                  <section>
                    <GroupTitle>Simple Fake</GroupTitle>
                    <div className="flex flex-col gap-1.5">
                      {simpleFake.map((item) => (
                        <StrategyLine
                          key={item.file}
                          label={familyLabel(item)}
                          active={item.file === selected}
                          onSelect={() => setSelected(item.file)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {other.length ? (
              <section>
                <GroupTitle>Другие</GroupTitle>
                <div className="flex flex-col gap-1.5">
                  {other.map((item) => (
                    <StrategyLine
                      key={item.file}
                      label={item.label}
                      active={item.file === selected}
                      onSelect={() => setSelected(item.file)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}

function GroupTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mb-2.5 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{children}</p>
  )
}

function StrategyTile({
  label,
  active,
  onSelect
}: {
  label: string
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[20px] px-4 py-3.5 text-left text-[14px] font-semibold transition-colors ${
        active ? 'bg-accent text-accent-ink' : 'bg-white/6 text-ink ring-1 ring-inset ring-white/8 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}

function StrategyLine({
  label,
  active,
  onSelect
}: {
  label: string
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl px-3.5 py-2.5 text-left text-[13px] transition-colors ${
        active ? 'bg-accent font-semibold text-accent-ink' : 'bg-white/6 text-ink ring-1 ring-inset ring-white/8 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}

function splitStrategies(items: ZapretStrategy[]): {
  recommended: ZapretStrategy[]
  alts: ZapretStrategy[]
  fakeTls: ZapretStrategy[]
  simpleFake: ZapretStrategy[]
  other: ZapretStrategy[]
} {
  const recommended = items.filter((item) => item.recommended)
  const rest = items.filter((item) => !item.recommended)
  const alts = rest
    .filter((item) => altNumber(item) != null)
    .sort((a, b) => (altNumber(a) ?? 0) - (altNumber(b) ?? 0))
  const fakeTls = rest
    .filter((item) => /fake\s*tls/i.test(item.file))
    .sort((a, b) => (extraAlt(a) ?? 0) - (extraAlt(b) ?? 0))
  const simpleFake = rest
    .filter((item) => /simple\s*fake/i.test(item.file))
    .sort((a, b) => (extraAlt(a) ?? 0) - (extraAlt(b) ?? 0))
  const used = new Set([...alts, ...fakeTls, ...simpleFake].map((item) => item.file))
  const other = rest.filter((item) => !used.has(item.file))
  return { recommended, alts, fakeTls, simpleFake, other }
}

function altNumber(item: ZapretStrategy): number | null {
  const match = item.file.match(/\(ALT\s*(\d+)\)/i) || item.label.match(/^ALT\s*(\d+)$/i)
  return match ? Number(match[1]) : null
}

function extraAlt(item: ZapretStrategy): number | null {
  const match = item.file.match(/ALT\s*(\d+)/i)
  return match ? Number(match[1]) : /alt/i.test(item.file) ? 0 : null
}

function familyLabel(item: ZapretStrategy): string {
  const numbered = extraAlt(item)
  if (numbered && numbered > 0) return `ALT ${numbered}`
  if (numbered === 0) return 'ALT'
  return item.label
}

function heading(item: ZapretStrategy): string {
  if (item.recommended) return item.label
  const numbered = altNumber(item)
  if (numbered != null) return `ALT ${numbered}`
  if (/fake\s*tls/i.test(item.file)) {
    const n = extraAlt(item)
    return n && n > 0 ? `Fake TLS Auto ALT ${n}` : 'Fake TLS Auto ALT'
  }
  if (/simple\s*fake/i.test(item.file)) {
    const n = extraAlt(item)
    return n && n > 0 ? `Simple Fake ALT ${n}` : 'Simple Fake ALT'
  }
  return item.label
}

function strategyTitle(value: string | null | undefined): string {
  if (!value) return 'стратегия'
  return value.replace(/\.bat$/i, '').replace(/^general\s*/i, '') || 'стратегия'
}

function withBat(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLowerCase().endsWith('.bat') ? value : `${value}.bat`
}
