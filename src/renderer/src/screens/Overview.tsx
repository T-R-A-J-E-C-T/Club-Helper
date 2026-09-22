import { Kicker, Skeleton } from '@renderer/components/Card'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { bytes, gib, ghz, ifaceType, ms, uptime } from '@renderer/lib/format'

export function Overview(): React.JSX.Element {
  const { network, system, pings, speed, runSpeedTest } = useDiagnostics()

  const pingValues = ['cloudflare', 'google', 'yandex']
    .map((id) => pings[id])
    .filter((item): item is NonNullable<(typeof pings)[string]> => Boolean(item))
  const pingTimes = pingValues.filter((item) => item.avgMs !== null)
  const pingAvg = pingTimes.length
    ? pingTimes.reduce((sum, item) => sum + (item.avgMs ?? 0), 0) / pingTimes.length
    : null

  const displayMbps = speed.result?.mbps ?? speed.live?.mbps ?? null
  const memPercent = system?.mem.total ? Math.round((system.mem.used / system.mem.total) * 100) : 0
  const gpu = system?.gpus[0]
  const place = network?.geo?.location || network?.geo?.country || ifaceType(network?.type ?? null)

  return (
    <div className="relative h-full min-h-0">
      <div className="pointer-events-none absolute inset-x-0 top-6 px-1">
        <div>
          <Kicker>Этот компьютер</Kicker>
          <h1 className="mt-3 max-w-[720px] text-[52px] leading-[0.92] font-semibold tracking-tight">
            {system?.hostname ?? 'Проверка ПК'}
          </h1>
          <p className="mt-3 text-[15px] text-muted">
            {place}
            {network?.geo?.isp ? ` · ${network.geo.isp}` : ''}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute top-[38%] left-[12%] rounded-full bg-page/55 px-3.5 py-2 text-[12px] backdrop-blur-md ring-1 ring-white/8">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        Пинг {pingAvg !== null ? ms(pingAvg) : '—'}
      </div>
      <div className="pointer-events-none absolute top-[44%] right-[14%] rounded-full bg-page/55 px-3.5 py-2 text-[12px] backdrop-blur-md ring-1 ring-white/8">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        {network?.externalIp ?? network?.ipv4 ?? 'нет IP'}
      </div>
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 grid grid-cols-2 gap-4">
        <article className="rounded-[28px] bg-surface/72 p-6 ring-1 ring-white/8 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <Kicker>Скорость</Kicker>
            <button
              type="button"
              disabled={speed.running}
              onClick={() => void runSpeedTest()}
              className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
            >
              {speed.running ? 'Замер…' : 'Замерить'}
            </button>
          </div>
          <p className="mt-4 text-[36px] leading-none font-semibold tracking-tight">
            {displayMbps != null ? displayMbps.toLocaleString('ru-RU') : speed.running ? '…' : '—'}
            <span className="ml-2 text-lg font-medium text-muted">Мбит/с</span>
          </p>
          {speed.result ? (
            <p className="mt-2 text-sm text-muted">
              {`${bytes(speed.result.bytes)} за ${(speed.result.durationMs / 1000).toFixed(1)} с`}
            </p>
          ) : speed.running && speed.live ? (
            <p className="mt-2 text-sm text-muted">{bytes(speed.live.bytes)}</p>
          ) : speed.error ? (
            <p className="mt-2 text-sm text-bad">{speed.error}</p>
          ) : null}
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-page-deep">
            <div
              className="meter-fill h-full rounded-full bg-accent"
              style={{ width: `${speed.running ? speed.progress : speed.result ? 100 : 0}%` }}
            />
          </div>
        </article>

        <article className="rounded-[28px] bg-surface/72 p-6 ring-1 ring-white/8 backdrop-blur-xl">
          {system ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Kicker>Компьютер</Kicker>
                  <p className="mt-2 text-[18px] leading-snug font-semibold">{shortCpu(system.cpu.brand)}</p>
                </div>
                <p className="text-[13px] text-muted">{uptime(system.uptimeSec)}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <SpecMeter
                  label="CPU"
                  value={system.loadPercent !== null ? `${system.loadPercent}%` : '—'}
                  hint={ghz(system.cpu.speedGHz) || `${system.cpu.physical} ядер`}
                  percent={system.loadPercent}
                />
                <SpecMeter
                  label="RAM"
                  value={gib(system.mem.used)}
                  hint={`из ${gib(system.mem.total)}`}
                  percent={memPercent}
                />
                <SpecMeter
                  label="GPU"
                  value={gpu?.usagePercent != null ? `${gpu.usagePercent}%` : shortGpu(gpu?.model)}
                  hint={gpu?.model ? shortGpu(gpu.model) : '—'}
                  percent={gpu?.usagePercent ?? null}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

function SpecMeter({
  label,
  value,
  hint,
  percent
}: {
  label: string
  value: string
  hint: string
  percent: number | null | undefined
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">{label}</p>
      <p className="mt-1 truncate text-[18px] font-semibold">{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted">{hint}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-page-deep">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
    </div>
  )
}

function shortCpu(brand: string): string {
  return brand.replace(/\(R\)|\(TM\)|CPU|Processor/g, '').replace(/\s+/g, ' ').trim()
}

function shortGpu(model?: string): string {
  if (!model) return '—'
  return model.replace(/NVIDIA |GeForce |AMD |Radeon /g, '').trim()
}
