import { Card, Kicker, Skeleton, Stat, StatusBadge } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { bytes, ifaceType, networkHealth } from '@renderer/lib/format'

export function NetworkScreen(): React.JSX.Element {
  const { network, pings, loading, speed, runSpeedTest } = useDiagnostics()

  const internetPing = pings.cloudflare ?? pings.google
  const level = network
    ? networkHealth({
        operstate: network.operstate,
        ipv4: network.ipv4,
        externalIp: network.externalIp,
        pingAlive: internetPing?.alive
      })
    : 'unknown'

  const displayMbps = speed.result?.mbps ?? speed.live?.mbps ?? null
  const gatewayPing = pings.gateway
  const cfPing = pings.cloudflare
  const place = [network?.geo?.location, network?.geo?.country].filter(Boolean).join(', ') || '—'

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        kicker="Сеть"
        title={
          network
            ? `${ifaceType(network.type)} · ${network.ipv4 ?? 'нет адреса'}`
            : 'Подключение этого ПК'
        }
        actions={network ? <StatusBadge level={level} /> : null}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.85fr] gap-4">
        <Card className="flex min-h-0 flex-col">
          {loading && !network ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Kicker>Адаптер</Kicker>
                  <p className="mt-3 truncate text-[22px] leading-snug font-semibold">
                    {network?.ifaceName ?? network?.iface ?? '—'}
                  </p>
                  <p className="mt-2 text-[15px] text-muted">
                    {network?.operstate === 'up' ? 'Подключён' : network?.operstate ?? '—'}
                    {network?.geo?.isp ? ` · ${network.geo.isp}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-8 grid min-h-0 flex-1 grid-cols-2 content-start gap-x-8 gap-y-6">
                <Stat label="Внешний IP" value={network?.externalIp ?? 'нет доступа'} />
                <Stat label="Шлюз" value={network?.gateway ?? 'нет'} />
                <Stat label="DNS" value={network?.dns.join(', ') || '—'} />
                <Stat label="Провайдер" value={network?.geo?.isp ?? '—'} />
                <Stat label="Гео" value={place} />
                <Stat
                  label="Линк"
                  value={network?.speedMbps ? `${network.speedMbps} Мбит/с` : '—'}
                />
                <Stat label="MAC" value={network?.mac ?? '—'} />
                <Stat
                  label="DHCP"
                  value={network?.dhcp == null ? '—' : network.dhcp ? 'да' : 'нет'}
                />
              </div>
            </>
          )}
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="flex min-h-0 flex-1 flex-col">
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
            <div className="mt-auto pt-6">
              <div className="h-1.5 overflow-hidden rounded-full bg-page-deep">
                <div
                  className="meter-fill h-full rounded-full bg-accent"
                  style={{ width: `${speed.running ? speed.progress : speed.result ? 100 : 0}%` }}
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <LatencyCard
              label="Шлюз"
              host={network?.gateway ?? '—'}
              ms={gatewayPing?.alive ? gatewayPing.avgMs : gatewayPing ? null : undefined}
              loss={gatewayPing?.lossPercent}
            />
            <LatencyCard
              label="1.1.1.1"
              host="Cloudflare"
              ms={cfPing?.alive ? cfPing.avgMs : cfPing ? null : undefined}
              loss={cfPing?.lossPercent}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function LatencyCard({
  label,
  host,
  ms,
  loss
}: {
  label: string
  host: string
  ms: number | null | undefined
  loss: number | null | undefined
}): React.JSX.Element {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <Kicker>{label}</Kicker>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight">
        {ms == null ? (ms === null ? 'нет' : '—') : `${ms} мс`}
      </p>
      <p className="mt-2 truncate text-[12px] text-muted">
        {host}
        {loss != null ? ` · потери ${loss}%` : ''}
      </p>
    </Card>
  )
}
