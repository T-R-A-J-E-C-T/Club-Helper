import { useEffect, useRef, useState } from 'react'
import { Card, Kicker } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { panelName } from '@renderer/lib/format'
import type { MonitorView } from '@shared/types'

function codeLabel(code: number): string {
  return code.toString(16).toUpperCase().padStart(2, '0')
}

export function DisplayScreen(): React.JSX.Element {
  const { monitors, monitorError, calibrating, calibrateMonitors } = useDiagnostics()
  const list = monitors ?? []
  const [live, setLive] = useState<(number | null)[]>([])
  const [trail, setTrail] = useState<number[][]>([])
  const calibratingRef = useRef(calibrating)
  calibratingRef.current = calibrating

  useEffect(() => {
    let stop = false
    let busy = false
    const tick = async (): Promise<void> => {
      if (stop || busy || calibratingRef.current) return
      busy = true
      try {
        const rows = await window.api.readMonitorModes()
        if (stop) return
        setLive(rows.map((row) => row.modeCode))
        setTrail((current) =>
          rows.map((row, index) => {
            const prev = current[index] ?? []
            const code = row.modeCode
            if (code == null || prev[prev.length - 1] === code) return prev
            return [...prev, code].slice(-12)
          })
        )
      } catch {
        // Keep the last codes on screen if one read misses.
      } finally {
        busy = false
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 1500)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        kicker="Экран"
        title="Калибровка"
        actions={
          <button
            type="button"
            disabled={calibrating || !list.length}
            onClick={() => void calibrateMonitors()}
            className="cursor-pointer rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
          >
            {calibrating ? 'Калибруем…' : 'Калибровать'}
          </button>
        }
      />

      {monitorError ? <p className="text-sm text-bad">{monitorError}</p> : null}

      <div className={`grid min-h-0 flex-1 gap-4 ${list.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {list.length ? (
          list.map((display, index) => (
            <MonitorCard
              key={`${display.resolution}-${index}`}
              display={display}
              index={index}
              code={live[index] ?? display.modeCode}
              trail={trail[index] ?? []}
              onReset={() => setTrail((current) => current.map((row, rowIndex) => (rowIndex === index ? [] : row)))}
            />
          ))
        ) : (
          <Card className="flex h-full items-center">
            <p className="text-[15px] text-muted">{monitors ? 'Дисплей не прочитан' : 'Читаем мониторы…'}</p>
          </Card>
        )}
      </div>
    </div>
  )
}

function MonitorCard({
  display,
  index,
  code,
  trail,
  onReset
}: {
  display: MonitorView
  index: number
  code: number | null
  trail: number[]
  onReset: () => void
}): React.JSX.Element {
  const title = panelName(display.name, index)
  const hz = display.refreshRate
  const max = display.maxRefreshRate
  const atMax = hz != null && max != null && hz >= max

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4">
        <Kicker>{title}</Kicker>
        <p className="text-[13px] text-muted">{display.resolution}</p>
      </div>

      <p className="mt-6 text-[72px] leading-none font-semibold tracking-tight">
        {hz ?? '—'}
        <span className="ml-3 text-[28px] font-medium text-muted">Гц</span>
      </p>
      <p className="mt-2 text-[15px] text-muted">{atMax ? 'Максимум для этого экрана' : max ? `Доступно до ${max} Гц` : 'Частота Windows'}</p>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">Код режима</p>
          <p className="mt-1 text-[40px] leading-none font-semibold tracking-tight">{code == null ? '—' : codeLabel(code)}</p>
        </div>
        <button type="button" onClick={onReset} className="cursor-pointer text-[13px] text-muted">
          Сбросить список
        </button>
      </div>
      <p className="mt-2 text-[15px] text-ink">{trail.length ? trail.map(codeLabel).join('  ·  ') : 'Ждём переключение'}</p>
      <p className="mt-1 text-[13px] text-muted">Листайте GameVisual на мониторе сверху вниз. Коды запишутся по порядку.</p>

      <div className="mt-auto grid grid-cols-2 gap-8 pt-6">
        <Level label="Яркость" value={display.brightness} />
        <Level label="Контраст" value={display.contrast} />
      </div>

      {display.steps?.length ? (
        <p className={`mt-6 text-[13px] ${display.ok ? 'text-muted' : 'text-bad'}`}>
          {display.steps.map((step) => step.label).join('  ·  ')}
        </p>
      ) : null}
      {display.note ? <p className="mt-2 text-[13px] text-bad">{display.note}</p> : null}
    </Card>
  )
}

function Level({ label, value }: { label: string; value: number | null }): React.JSX.Element {
  const percent = value == null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">{label}</p>
        <p className="text-[22px] leading-none font-semibold">{value ?? '—'}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-page-deep">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

