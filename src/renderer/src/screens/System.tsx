import { Card, Kicker, Skeleton, Stat } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { bytes, ghz, gib, panelName, uptime } from '@renderer/lib/format'

export function SystemScreen(): React.JSX.Element {
  const { system, loading, refreshSystem, monitors } = useDiagnostics()

  if (loading && !system) {
    return (
      <div className="grid h-full grid-cols-3 gap-4">
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    )
  }

  if (!system) {
    return (
      <Card>
        <p>Не удалось прочитать систему.</p>
        <button
          type="button"
          className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          onClick={() => void refreshSystem()}
        >
          Повторить
        </button>
      </Card>
    )
  }

  const memPercent = system.mem.total ? Math.round((system.mem.used / system.mem.total) * 100) : 0
  const gpu = system.gpus[0]

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        kicker="Система"
        title={system.hostname}
        actions={
          <span className="flex items-center gap-2 rounded-full bg-page/55 px-3.5 py-2 text-[13px] text-muted backdrop-blur-md ring-1 ring-white/8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          </span>
        }
      />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="grid grid-cols-3 gap-4">
          <MeterCard
            kicker="CPU"
            value={system.loadPercent !== null ? `${system.loadPercent}%` : '—'}
            hint={`${shortCpu(system.cpu.brand)}${system.cpu.speedGHz ? ` · ${ghz(system.cpu.speedGHz)}` : ''}`}
            percent={system.loadPercent}
            extra={
              system.cpuTemp !== null
                ? `${Math.round(system.cpuTemp)}° · ${system.cpu.physical} ядер`
                : `${system.cpu.physical} физ. / ${system.cpu.cores} потоков`
            }
          />
          <MeterCard
            kicker="RAM"
            value={gib(system.mem.used)}
            hint={`из ${gib(system.mem.total)}`}
            percent={memPercent}
            extra={`${memPercent}% · свободно ${gib(system.mem.available)}`}
          />
          <MeterCard
            kicker="GPU"
            value={gpu?.usagePercent != null ? `${gpu.usagePercent}%` : '—'}
            hint={gpu?.model ? shortGpu(gpu.model) : 'не определён'}
            percent={gpu?.usagePercent ?? null}
            extra={
              gpu?.memoryUsedMb != null && gpu.vramMb
                ? `${gpu.memoryUsedMb} / ${gpu.vramMb} МБ${gpu.temp != null ? ` · ${Math.round(gpu.temp)}°` : ''}`
                : gpu?.vramMb
                  ? `${gpu.vramMb} МБ`
                  : 'VRAM неизвестна'
            }
          />
        </div>

        <div className="grid min-h-0 grid-cols-3 gap-4">
          <Card className="flex min-h-0 flex-col">
            <Kicker>Экраны</Kicker>
            <div className="mt-4 min-h-0 flex-1 space-y-5">
              {monitors == null ? (
                <p className="text-sm text-muted">Читаем экраны…</p>
              ) : monitors.length ? (
                monitors.map((display, index) => (
                  <Stat
                    key={`${display.name}-${display.refreshRate}-${index}`}
                    label={display.refreshRate ? `${display.refreshRate} Гц` : 'монитор'}
                    value={display.resolution}
                    hint={panelName(display.name, index)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted">Дисплей не прочитан</p>
              )}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col">
            <Kicker>Диски</Kicker>
            <div className="menu-scroll mt-4 min-h-0 flex-1 space-y-4 pr-1">
              {system.disks.map((disk) => (
                <div key={disk.mount || disk.fs}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold">{disk.mount || disk.fs}</p>
                    <p className="shrink-0 text-[12px] text-muted">{Math.round(disk.usePercent)}%</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-page-deep">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${disk.usePercent}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {bytes(disk.available)} свободно из {bytes(disk.size)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col">
            <Kicker>ОС</Kicker>
            <p className="mt-4 text-[22px] leading-snug font-semibold tracking-tight">{system.os}</p>
            <p className="mt-2 text-[15px] text-muted">
              {[system.manufacturer, system.model, system.osArch].filter(Boolean).join(' · ') ||
                system.osArch}
            </p>
            <p className="mt-auto pt-6 text-[13px] text-muted">аптайм {uptime(system.uptimeSec)}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MeterCard({
  kicker,
  value,
  hint,
  percent,
  extra
}: {
  kicker: string
  value: string
  hint: string
  percent: number | null | undefined
  extra: string
}): React.JSX.Element {
  return (
    <Card>
      <Kicker>{kicker}</Kicker>
      <p className="mt-3 text-[36px] leading-none font-semibold tracking-tight">{value}</p>
      <p className="mt-2 truncate text-[13px] text-muted">{hint}</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-page-deep">
        <div
          className="meter-fill h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
      <p className="mt-2 truncate text-[12px] text-muted">{extra}</p>
    </Card>
  )
}

function shortCpu(brand: string): string {
  return brand.replace(/\(R\)|\(TM\)|CPU|Processor/g, '').replace(/\s+/g, ' ').trim()
}

function shortGpu(model?: string): string {
  if (!model) return '—'
  return model.replace(/NVIDIA |GeForce |AMD |Radeon /g, '').trim()
}
