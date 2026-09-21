import { execFile } from 'node:child_process'
import { promises as dns } from 'node:dns'
import https from 'node:https'
import net from 'node:net'
import { promisify } from 'node:util'
import { net as electronNet, type WebContents } from 'electron'
import si from 'systeminformation'
import type {
  GpuInfo,
  MemInfo,
  NetworkInfo,
  PingResult,
  PingTarget,
  SpeedProgress,
  SpeedTestResult,
  SystemInfo,
  SystemLive,
  GeoIpInfo
} from '@shared/types'

const execFileAsync = promisify(execFile)

const PING_TIMEOUT_MS = 18_000
const SPEED_STREAMS = 6
const SPEED_WARMUP_MS = 2_000
const SPEED_MEASURE_MS = 8_000
const SPEED_FAIL_MS = 4_000
const SPEED_MIN_BYTES = 1_000_000
const SPEED_DURATION_MS = SPEED_WARMUP_MS + SPEED_MEASURE_MS
const YANDEX_PROBES_URL = 'https://yandex.ru/internet/api/v0/get-probes'
const SPEED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const EXTERNAL_IP_URL = 'https://api.ipify.org?format=json'

void si.currentLoad().catch(() => undefined)

function isWindows(): boolean {
  return process.platform === 'win32'
}

async function resolveGateway(): Promise<string | null> {
  try {
    const gateway = await si.networkGatewayDefault()
    return gateway || null
  } catch {
    return null
  }
}

function parsePingOutput(stdout: string, sent: number): Omit<
  PingResult,
  'id' | 'host' | 'label'
> {
  const times: number[] = []
  const timeRe = /(?:time|время)\s*[=<]\s*(\d+)/gi
  let match: RegExpExecArray | null
  while ((match = timeRe.exec(stdout))) {
    times.push(Number(match[1]))
  }
  if (!times.length) {
    const loose = stdout.matchAll(/(\d+)\s*(?:ms|мсек|мс)\b/gi)
    for (const item of loose) {
      const value = Number(item[1])
      if (value < 5000) times.push(value)
    }
  }

  const avgMatch = stdout.match(/(?:Average|Среднее)\s*=\s*(\d+)/i)
  const minMatch = stdout.match(/(?:Minimum|Минимальное)\s*=\s*(\d+)/i)
  const maxMatch = stdout.match(/(?:Maximum|Максимальное)\s*=\s*(\d+)/i)
  const receivedMatch = stdout.match(/(?:Received|получено)\s*=\s*(\d+)/i)
  const lostCount = stdout.match(/(?:Lost|потеряно)\s*=\s*(\d+)/i)
  const lossParen = stdout.match(/\((\d+)\s*%/)

  const receivedFromStats = receivedMatch ? Number(receivedMatch[1]) : null
  const received = receivedFromStats ?? times.length
  const avgMs = avgMatch
    ? Number(avgMatch[1])
    : times.length
      ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length)
      : null
  const minMs = minMatch ? Number(minMatch[1]) : times.length ? Math.min(...times) : null
  const maxMs = maxMatch ? Number(maxMatch[1]) : times.length ? Math.max(...times) : null
  let lossPercent = lossParen ? Number(lossParen[1]) : null
  if (lostCount && sent) {
    lossPercent = Math.round((Number(lostCount[1]) / sent) * 100)
  } else if (lossPercent === null && sent) {
    lossPercent = Math.round((1 - received / sent) * 100)
  }
  if (received === 0 && sent > 0) {
    lossPercent = 100
  }

  const alive = received > 0 || avgMs !== null || /TTL=/i.test(stdout)

  return {
    alive,
    avgMs: alive ? avgMs : null,
    minMs: alive ? minMs : null,
    maxMs: alive ? maxMs : null,
    sent,
    received,
    lossPercent
  }
}

function safeHost(host: string): string {
  if (!/^[A-Za-z0-9._:-]+$/.test(host)) {
    throw new Error('Некорректный хост')
  }
  return host
}

async function runPingCommand(host: string, count: number): Promise<string> {
  const target = safeHost(host)
  if (isWindows()) {
    const { stdout } = await execFileAsync(
      'cmd.exe',
      ['/d', '/c', `chcp 437>nul && ping -4 -n ${count} -w 2000 ${target}`],
      {
        timeout: PING_TIMEOUT_MS,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      }
    )
    return stdout
  }

  const { stdout } = await execFileAsync('ping', ['-c', String(count), '-W', '2', target], {
    timeout: PING_TIMEOUT_MS,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  })
  return stdout
}

async function tcpProbe(host: string, port: number, timeoutMs = 4000): Promise<number> {
  const target = safeHost(host)
  return await new Promise((resolve, reject) => {
    const started = Date.now()
    const socket = net.connect({ host: target, port, family: 4 })
    const finish = (error?: Error): void => {
      socket.removeAllListeners()
      socket.destroy()
      if (error) reject(error)
      else resolve(Date.now() - started)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish())
    socket.once('timeout', () => finish(new Error('timeout')))
    socket.once('error', (error) => finish(error))
  })
}

export async function pingTarget(target: PingTarget, count = 4): Promise<PingResult> {
  let host = target.host
  if (host === '__gateway__') {
    const gateway = await resolveGateway()
    if (!gateway) {
      return {
        id: target.id,
        host: 'шлюз',
        label: target.label,
        alive: false,
        avgMs: null,
        minMs: null,
        maxMs: null,
        sent: 0,
        received: 0,
        lossPercent: 100,
        via: 'icmp',
        error: 'Шлюз не найден'
      }
    }
    host = gateway.split('%')[0]
  }

  let icmp: Omit<PingResult, 'id' | 'host' | 'label'>
  try {
    const stdout = await runPingCommand(host, count)
    icmp = parsePingOutput(stdout, count)
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? ''
    icmp = stdout
      ? parsePingOutput(stdout, count)
      : {
          alive: false,
          avgMs: null,
          minMs: null,
          maxMs: null,
          sent: count,
          received: 0,
          lossPercent: 100,
          error: error instanceof Error ? error.message : 'Нет ответа'
        }
  }

  if (icmp.alive) {
    return { id: target.id, host, label: target.label, via: 'icmp', ...icmp }
  }

  if (target.port) {
    try {
      const tcpMs = await tcpProbe(host, target.port)
      return {
        id: target.id,
        host,
        label: target.label,
        alive: true,
        avgMs: tcpMs,
        minMs: tcpMs,
        maxMs: tcpMs,
        sent: 1,
        received: 1,
        lossPercent: 0,
        via: 'tcp',
        port: target.port
      }
    } catch {
      // fall through to ICMP miss
    }
  }

  return { id: target.id, host, label: target.label, via: 'icmp', port: target.port, ...icmp }
}

export async function pingMany(
  targets: PingTarget[],
  count: number,
  sender?: WebContents
): Promise<PingResult[]> {
  const results: PingResult[] = []
  const queue = [...targets]

  const worker = async (): Promise<void> => {
    while (queue.length) {
      const target = queue.shift()
      if (!target) return
      const result = await pingTarget(target, count)
      results.push(result)
      if (sender && !sender.isDestroyed()) {
        sender.send('diag:ping-result', result)
      }
    }
  }

  await Promise.all(Array.from({ length: 5 }, () => worker()))
  return results
}

function isDummy(value: string | null | undefined): boolean {
  if (!value) return true
  const lowered = value.toLowerCase()
  return (
    lowered.includes('system product name') ||
    lowered.includes('to be filled') ||
    lowered === 'default string' ||
    lowered === 'none' ||
    lowered === 'unknown'
  )
}

async function getDnsServers(): Promise<string[]> {
  const fallback = dns.getServers()
  if (!isWindows()) return fallback
  try {
    const { stdout } = await execFileAsync('ipconfig', ['/all'], {
      timeout: 8000,
      windowsHide: true,
      encoding: 'utf8'
    })
    const found: string[] = []
    const ipRe = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/g
    const blocks = stdout.split(/DNS[- ]Servers?|DNS[\s.\-]*сервер[\s\w]*[:.]?/i).slice(1)
    for (const block of blocks) {
      const chunk = block.split(/\r?\n/).slice(0, 6).join('\n')
      let match: RegExpExecArray | null
      ipRe.lastIndex = 0
      while ((match = ipRe.exec(chunk))) {
        found.push(match[1])
      }
    }
    const unique = [...new Set(found)]
    const publicDns = unique.filter((ip) => ip !== '127.0.0.1' && !ip.startsWith('0.'))
    return publicDns.length ? publicDns : unique.length ? unique : fallback
  } catch {
    return fallback
  }
}

async function fetchExternalIp(): Promise<string | null> {
  return await new Promise((resolve) => {
    const req = https.get(EXTERNAL_IP_URL, { timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body) as { ip?: string }
          resolve(parsed.ip ?? null)
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

async function lookupGeoIp(ip: string | null): Promise<GeoIpInfo | null> {
  if (!ip || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return null
  return await new Promise((resolve) => {
    const req = https.get(`https://ipwho.is/${encodeURIComponent(ip)}`, { timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body) as {
            success?: boolean
            ip?: string
            country?: string
            city?: string
            latitude?: number
            longitude?: number
            connection?: { isp?: string; org?: string }
          }
          if (!parsed.success) {
            resolve(null)
            return
          }
          resolve({
            ip: parsed.ip ?? ip,
            country: parsed.country ?? null,
            location: parsed.city ?? null,
            isp: parsed.connection?.isp ?? null,
            org: parsed.connection?.org ?? null,
            lat: typeof parsed.latitude === 'number' ? parsed.latitude : null,
            lon: typeof parsed.longitude === 'number' ? parsed.longitude : null,
            ismobile: false,
            isproxy: false
          })
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const [hostname, interfaces, gateway, dnsServers, defaultIface] = await Promise.all([
    si.osInfo().then((info) => info.hostname).catch(() => 'ПК'),
    si.networkInterfaces().catch(() => []),
    resolveGateway(),
    getDnsServers(),
    si.networkInterfaceDefault().catch(() => null)
  ])

  const list = Array.isArray(interfaces) ? interfaces : []
  const preferred =
    list.find((item) => item.iface === defaultIface && !item.internal) ??
    list.find((item) => item.default && !item.internal) ??
    list.find((item) => !item.internal && item.operstate === 'up') ??
    list.find((item) => !item.internal) ??
    null

  const externalIp = await fetchExternalIp()
  const geo = await lookupGeoIp(externalIp)

  return {
    hostname,
    iface: preferred?.iface ?? null,
    ifaceName: preferred?.ifaceName ?? preferred?.iface ?? null,
    type: preferred?.type ?? null,
    operstate: preferred?.operstate ?? null,
    speedMbps: typeof preferred?.speed === 'number' ? preferred.speed : null,
    ipv4: preferred?.ip4 || null,
    ipv6: preferred?.ip6 || null,
    mac: preferred?.mac || null,
    gateway,
    dns: dnsServers,
    dhcp: typeof preferred?.dhcp === 'boolean' ? preferred.dhcp : null,
    externalIp,
    geo
  }
}

export async function runSpeedTest(sender?: WebContents): Promise<SpeedTestResult> {
  const nonce = Date.now()
  const plans: string[][] = []
  try {
    plans.push(await fetchYandexDownloadUrls())
  } catch {
    // fallbacks below
  }
  plans.push(...speedTestPlans(nonce))
  const errors: string[] = []
  for (const urls of plans) {
    try {
      return await measureSpeedPlan(urls, sender)
    } catch (error) {
      const host = new URL(urls[0]).hostname
      errors.push(`${host}: ${error instanceof Error ? error.message : 'ошибка'}`)
    }
  }
  return {
    bytes: 0,
    durationMs: 0,
    mbps: 0,
    error: errors[0] ? `Не удалось замерить скорость (${errors[0]})` : 'Не удалось замерить скорость'
  }
}

function speedTestPlans(nonce: number): string[][] {
  const stamp = (base: string, index: number): string =>
    `${base}${base.includes('?') ? '&' : '?'}n=${nonce}-${index}`
  const fanout = (base: string): string[] =>
    Array.from({ length: SPEED_STREAMS }, (_, index) => stamp(base, index))
  return [
    fanout('https://speed.cloudflare.com/__down?bytes=500000000'),
    fanout('https://cachefly.cachefly.net/100mb.test'),
    fanout('https://speedtest.selectel.ru/1GB')
  ]
}

function fetchYandexDownloadUrls(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = `${YANDEX_PROBES_URL}?t=${Date.now()}`
    const req = https.get(
      url,
      {
        timeout: 6000,
        headers: {
          'User-Agent': SPEED_USER_AGENT,
          Accept: 'application/json',
          Referer: 'https://yandex.ru/internet/',
          Origin: 'https://yandex.ru'
        }
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as {
              download?: { probes?: Array<{ url?: string }> }
            }
            const unique = [
              ...new Set(
                (parsed.download?.probes ?? [])
                  .map((probe) => probe.url)
                  .filter((item): item is string => Boolean(item && item.includes('50mb')))
              )
            ]
            if (!unique.length) {
              reject(new Error('яндекс не отдал пробы'))
              return
            }
            resolve(Array.from({ length: unique.length * 2 }, (_, index) => unique[index % unique.length]))
          } catch (error) {
            reject(error instanceof Error ? error : new Error('яндекс вернул мусор'))
          }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('яндекс не ответил'))
    })
  })
}

function withCacheBust(url: string): string {
  const rid = Math.random().toString(36).slice(2)
  return `${url}${url.includes('?') ? '&' : '?'}rid=${rid}`
}

function applySpeedHeaders(request: Electron.ClientRequest, url: string): void {
  request.setHeader('User-Agent', SPEED_USER_AGENT)
  request.setHeader('Accept', '*/*')
  request.setHeader('Accept-Encoding', 'identity')
  request.setHeader('Cache-Control', 'no-cache')
  if (url.includes('cloudflare.com')) {
    request.setHeader('Referer', 'https://speed.cloudflare.com/')
  }
  if (url.includes('yandex.')) {
    request.setHeader('Referer', 'https://yandex.ru/internet/')
    request.setHeader('Origin', 'https://yandex.ru')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function startSpeedStream(url: string, onChunk: (bytes: number) => void): { abort: () => void } {
  let aborted = false
  let request: ReturnType<typeof electronNet.request> | null = null

  const go = (): void => {
    if (aborted) return
    const target = withCacheBust(url)
    const next = electronNet.request({
      method: 'GET',
      url: target,
      redirect: 'follow'
    })
    request = next
    applySpeedHeaders(next, target)
    next.on('response', (res) => {
      if (aborted) {
        try {
          next.abort()
        } catch {
          // ignore
        }
        return
      }
      if (res.statusCode >= 400) {
        try {
          next.abort()
        } catch {
          // ignore
        }
        if (!aborted) setTimeout(go, 250)
        return
      }
      res.on('data', (chunk: Buffer) => {
        if (!aborted) onChunk(chunk.length)
      })
      res.on('end', () => {
        if (!aborted) go()
      })
    })
    next.on('error', () => {
      if (!aborted) setTimeout(go, 250)
    })
    next.end()
  }

  go()

  return {
    abort: () => {
      aborted = true
      try {
        request?.abort()
      } catch {
        // already closed
      }
    }
  }
}

async function measureSpeedPlan(urls: string[], sender?: WebContents): Promise<SpeedTestResult> {
  let downloaded = 0
  let measured = 0
  let measuring = false
  const started = Date.now()
  let measureStartedAt = 0
  let lastReport = 0

  const report = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastReport < 120) return
    lastReport = now
    if (!sender || sender.isDestroyed()) return
    const elapsedMs = now - started
    const windowMs = measuring ? Math.max(now - measureStartedAt, 1) : 0
    const mbps =
      measuring && measured > 0
        ? Math.round(((measured * 8) / (windowMs / 1000) / 1_000_000) * 10) / 10
        : 0
    const payload: SpeedProgress = {
      downloaded,
      total: SPEED_DURATION_MS,
      elapsedMs,
      mbps
    }
    sender.send('diag:speed-progress', payload)
  }

  const streams = urls.map((url) =>
    startSpeedStream(url, (size) => {
      downloaded += size
      if (measuring) measured += size
      report()
    })
  )

  const abortAll = (): void => {
    for (const stream of streams) stream.abort()
  }

  try {
    await sleep(SPEED_WARMUP_MS)
    if (downloaded < 64_000) {
      await sleep(Math.max(0, SPEED_FAIL_MS - SPEED_WARMUP_MS))
      if (downloaded < 64_000) throw new Error('сервер не отдал тестовый файл')
    }

    measuring = true
    measureStartedAt = Date.now()
    const before = downloaded
    await sleep(SPEED_MEASURE_MS)
    measured = Math.max(measured, downloaded - before)
    abortAll()

    const durationMs = Math.max(Date.now() - measureStartedAt, 1)
    if (measured < SPEED_MIN_BYTES) throw new Error('сервер отдал слишком мало данных')
    const mbps = Math.round(((measured * 8) / (durationMs / 1000) / 1_000_000) * 10) / 10
    report(true)
    return { bytes: measured, durationMs, mbps }
  } catch (error) {
    abortAll()
    throw error
  }
}

function toMemInfo(mem: { total: number; used: number; available: number; free?: number }): MemInfo {
  const available = mem.available || mem.free || 0
  return {
    total: mem.total,
    used: Math.max(0, mem.total - available),
    available
  }
}

function mapGraphicsGpus(
  controllers: Array<{
    model?: string
    vram?: number | null
    memoryUsed?: number | null
    utilizationGpu?: number | null
    temperatureGpu?: number | null
  }>
): GpuInfo[] {
  return controllers
    .filter((gpu) => gpu.model)
    .map((gpu) => ({
      model: gpu.model as string,
      vramMb: typeof gpu.vram === 'number' ? gpu.vram : null,
      memoryUsedMb: typeof gpu.memoryUsed === 'number' ? Math.round(gpu.memoryUsed) : null,
      usagePercent: typeof gpu.utilizationGpu === 'number' ? Math.round(gpu.utilizationGpu) : null,
      temp: typeof gpu.temperatureGpu === 'number' ? gpu.temperatureGpu : null
    }))
}

function gpuNamesClose(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left.includes(right) || right.includes(left)
}

function mergeLiveGpus(base: GpuInfo[], live: GpuInfo[]): GpuInfo[] {
  if (!live.length) return base
  if (!base.length) return live
  return base.map((gpu, index) => {
    const match =
      live.find((item) => gpuNamesClose(item.model, gpu.model)) ??
      (live.length === base.length ? live[index] : null)
    if (!match) return gpu
    return {
      ...gpu,
      usagePercent: match.usagePercent,
      temp: match.temp,
      memoryUsedMb: match.memoryUsedMb,
      vramMb: match.vramMb ?? gpu.vramMb
    }
  })
}

async function readNvidiaLive(): Promise<GpuInfo[] | null> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      [
        '--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits'
      ],
      { timeout: 2500, windowsHide: true }
    )
    const gpus: GpuInfo[] = []
    for (const line of stdout.trim().split(/\r?\n/)) {
      const parts = line.split(',').map((part) => part.trim())
      if (parts.length < 5) continue
      const [name, util, temp, memUsed, memTotal] = parts
      gpus.push({
        model: name,
        usagePercent: Number.isFinite(Number(util)) ? Math.round(Number(util)) : null,
        temp: Number.isFinite(Number(temp)) ? Number(temp) : null,
        memoryUsedMb: Number.isFinite(Number(memUsed)) ? Math.round(Number(memUsed)) : null,
        vramMb: Number.isFinite(Number(memTotal)) ? Math.round(Number(memTotal)) : null
      })
    }
    return gpus.length ? gpus : null
  } catch {
    return null
  }
}

export async function getSystemLive(): Promise<SystemLive> {
  const [mem, load, speed, temp, nvidia] = await Promise.all([
    si.mem(),
    si.currentLoad().catch(() => ({ currentLoad: null as number | null })),
    si.cpuCurrentSpeed().catch(() => ({ avg: 0 })),
    si.cpuTemperature().catch(() => ({ main: null as number | null })),
    readNvidiaLive()
  ])
  const time = si.time()
  const avg = typeof speed.avg === 'number' && speed.avg > 0 ? speed.avg : null

  return {
    loadPercent: typeof load.currentLoad === 'number' ? Math.round(load.currentLoad) : null,
    cpuSpeedGHz: avg,
    cpuTemp: typeof temp.main === 'number' ? temp.main : null,
    mem: toMemInfo(mem),
    gpus: nvidia ?? [],
    uptimeSec: time.uptime ?? 0
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const [osInfo, system, cpu, graphics, fsSize, live] = await Promise.all([
    si.osInfo(),
    si.system().catch(() => ({ manufacturer: '', model: '' })),
    si.cpu(),
    si.graphics().catch(() => ({ controllers: [], displays: [] })),
    si.fsSize().catch(() => []),
    getSystemLive()
  ])

  const disks = (fsSize ?? [])
    .filter((disk) => disk.size > 0)
    .map((disk) => ({
      fs: disk.fs,
      mount: disk.mount,
      size: disk.size,
      used: disk.used,
      available: disk.available,
      usePercent: Math.round(disk.use)
    }))

  const displays = (graphics.displays ?? []).map((display) => {
    const width = display.resolutionX || display.currentResX
    const height = display.resolutionY || display.currentResY
    const resolution = width && height ? `${width}×${height}` : 'неизвестно'
    return {
      model: display.model || null,
      vendor: display.vendor || null,
      resolution,
      refreshRate: display.currentRefreshRate || display.refreshRate || null,
      builtin: typeof display.builtin === 'boolean' ? display.builtin : null,
      connection: display.connection || null
    }
  })

  const gpus = mergeLiveGpus(mapGraphicsGpus(graphics.controllers ?? []), live.gpus)

  return {
    hostname: osInfo.hostname,
    manufacturer: isDummy(system.manufacturer) ? null : system.manufacturer || null,
    model: isDummy(system.model) ? null : system.model || null,
    os: `${osInfo.distro} ${osInfo.release}`.replace(/^Microsoft\s+/i, '').replace(/^Майкрософт\s+/i, '').trim(),
    osArch: osInfo.arch,
    uptimeSec: live.uptimeSec,
    cpu: {
      brand: cpu.brand,
      cores: cpu.cores,
      physical: cpu.physicalCores,
      speedGHz: live.cpuSpeedGHz ?? cpu.speed ?? null
    },
    mem: live.mem,
    gpus,
    disks,
    displays,
    cpuTemp: live.cpuTemp,
    loadPercent: live.loadPercent
  }
}
