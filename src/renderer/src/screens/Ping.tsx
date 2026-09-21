import { useEffect, useMemo, useState } from 'react'
import { PING_PAGES, PING_PAGE_SIZE, PING_TARGETS, type PingPageId } from '@shared/types'
import { Card, StatusBadge } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { ms, pingHealth } from '@renderer/lib/format'

const titles: Record<PingPageId, string> = {
  dns: 'DNS и шлюз',
  launchers: 'Лаунчеры',
  games: 'Популярные игры'
}

export function PingScreen({ active = true }: { active?: boolean }): React.JSX.Element {
  const { pings, pendingPings, runPings } = useDiagnostics()
  const [sectionId, setSectionId] = useState<PingPageId>('dns')
  const [leaf, setLeaf] = useState(0)

  const sectionTargets = useMemo(
    () => PING_TARGETS.filter((target) => target.page === sectionId),
    [sectionId]
  )
  const pageCount = Math.max(1, Math.ceil(sectionTargets.length / PING_PAGE_SIZE))
  const pageIndex = Math.min(leaf, pageCount - 1)
  const targets = useMemo(
    () => sectionTargets.slice(pageIndex * PING_PAGE_SIZE, (pageIndex + 1) * PING_PAGE_SIZE),
    [sectionTargets, pageIndex]
  )
  const canPage = pageCount > 1
  const heading = sectionId === 'games' && pageIndex > 0 ? 'Ещё игры' : titles[sectionId]
  const pageBusy = targets.some((target) => pendingPings[target.id])

  useEffect(() => {
    if (!canPage || !active) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, canPage, pageCount])

  function go(delta: number): void {
    if (pageCount <= 1) return
    setLeaf((current) => {
      const next = Math.min(current, pageCount - 1) + delta
      if (next < 0 || next >= pageCount) return Math.min(current, pageCount - 1)
      return next
    })
  }

  function openSection(id: PingPageId): void {
    setSectionId(id)
    setLeaf(0)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        kicker="Пинг"
        title={heading}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full bg-page/55 p-1 backdrop-blur-md ring-1 ring-white/8">
              {PING_PAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                    item.id === sectionId
                      ? 'bg-accent font-semibold text-accent-ink'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={pageBusy}
              onClick={() => {
                void runPings(4, targets)
              }}
              className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
            >
              {pageBusy ? 'Проверка…' : 'Проверить'}
            </button>
          </>
        }
      />

      <div className={`flex min-h-0 flex-1 items-stretch ${canPage ? 'gap-3' : ''}`}>
        {canPage ? (
          <PagerButton label="Назад" disabled={pageIndex === 0} onClick={() => go(-1)} />
        ) : null}
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-3">
          {targets.map((target) => {
            const result = pings[target.id]
            const busy = Boolean(pendingPings[target.id])
            const level = busy
              ? 'pending'
              : result
                ? pingHealth(
                    result.avgMs,
                    result.lossPercent,
                    result.alive,
                    target.group === 'game' || target.group === 'launcher' ? 'game' : 'net'
                  )
                : 'unknown'
            return (
              <Card key={target.id} className="flex min-h-0 flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{target.label}</p>
                    <p className="mt-1 truncate text-[12px] text-muted">
                      {target.hint ?? result?.host ?? target.host}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Проверить ${target.label}`}
                      disabled={busy}
                      onClick={() => void runPings(4, [target])}
                      className="grid h-7 w-7 place-items-center rounded-full bg-white/6 text-muted hover:bg-white/10 hover:text-ink disabled:opacity-40"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                        className={busy ? 'animate-spin' : undefined}
                      >
                        <path
                          d="M12 7a5 5 0 1 1-1.3-3.4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 2.5V5.5H9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <StatusBadge level={level} />
                  </div>
                </div>
                <div>
                  <p className="text-[32px] leading-none font-semibold tracking-tight">
                    {busy ? '…' : result ? (result.alive ? ms(result.avgMs) : 'нет') : '—'}
                  </p>
                  <p className="mt-2 text-[12px] text-muted">
                    {busy
                      ? 'проверка'
                      : result
                        ? result.via === 'tcp'
                          ? `TCP ${result.port ?? 443}`
                          : `${result.received}/${result.sent} · потери ${result.lossPercent ?? '—'}%`
                        : 'ожидание'}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
        {canPage ? (
          <PagerButton
            label="Дальше"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => go(1)}
          />
        ) : null}
      </div>
    </div>
  )
}

function PagerButton({
  label,
  onClick,
  disabled
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  const back = label === 'Назад'
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center self-center rounded-full bg-page/55 text-muted ring-1 ring-white/8 backdrop-blur-md hover:bg-white/10 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d={back ? 'M9 3L5 7l4 4' : 'M5 3l4 4-4 4'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
