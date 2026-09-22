export type HealthLevel = 'ok' | 'warn' | 'bad' | 'unknown' | 'pending'

export type TabId = 'overview' | 'network' | 'ping' | 'audio' | 'system' | 'display' | 'zapret' | 'settings'

export interface AppSettings {
  openAtLogin: boolean
  startInTray: boolean
}

export interface NetworkInfo {
  hostname: string
  iface: string | null
  ifaceName: string | null
  type: string | null
  operstate: string | null
  speedMbps: number | null
  ipv4: string | null
  ipv6: string | null
  mac: string | null
  gateway: string | null
  dns: string[]
  dhcp: boolean | null
  externalIp: string | null
  geo: GeoIpInfo | null
}

export interface GeoIpInfo {
  ip: string
  country: string | null
  location: string | null
  isp: string | null
  org: string | null
  lat: number | null
  lon: number | null
  ismobile: boolean
  isproxy: boolean
}

export type PingPageId = 'dns' | 'launchers' | 'games'

export interface PingTarget {
  id: string
  label: string
  host: string
  group: 'local' | 'dns' | 'launcher' | 'game'
  page: PingPageId
  port?: number
  hint?: string
}

export interface PingResult {
  id: string
  host: string
  label: string
  alive: boolean
  avgMs: number | null
  minMs: number | null
  maxMs: number | null
  sent: number
  received: number
  lossPercent: number | null
  via?: 'icmp' | 'tcp'
  port?: number
  error?: string
}

export interface SpeedProgress {
  downloaded: number
  total: number
  elapsedMs: number
  mbps: number
}

export interface SpeedTestResult {
  bytes: number
  durationMs: number
  mbps: number
  error?: string
}

export interface CpuInfo {
  brand: string
  cores: number
  physical: number
  speedGHz: number | null
}

export interface MemInfo {
  total: number
  used: number
  available: number
}

export interface GpuInfo {
  model: string
  vramMb: number | null
  memoryUsedMb: number | null
  usagePercent: number | null
  temp: number | null
}

export interface DiskInfo {
  fs: string
  mount: string
  size: number
  used: number
  available: number
  usePercent: number
}

export interface DisplayInfo {
  model: string | null
  vendor: string | null
  resolution: string
  refreshRate: number | null
  builtin: boolean | null
  connection: string | null
}

export interface MonitorStep {
  label: string
  ok: boolean
}

export interface MonitorView {
  name: string
  resolution: string
  refreshRate: number | null
  maxRefreshRate: number | null
  brightness: number | null
  contrast: number | null
  modeCode: number | null
  ok: boolean
  note: string | null
  steps: MonitorStep[]
}

export interface SystemInfo {
  hostname: string
  manufacturer: string | null
  model: string | null
  os: string
  osArch: string
  uptimeSec: number
  cpu: CpuInfo
  mem: MemInfo
  gpus: GpuInfo[]
  disks: DiskInfo[]
  displays: DisplayInfo[]
  cpuTemp: number | null
  loadPercent: number | null
}

export interface SystemLive {
  loadPercent: number | null
  cpuSpeedGHz: number | null
  cpuTemp: number | null
  mem: MemInfo
  gpus: GpuInfo[]
  uptimeSec: number
}

export const PING_TARGETS: PingTarget[] = [
  { id: 'gateway', label: 'Шлюз', host: '__gateway__', group: 'local', page: 'dns' },
  { id: 'cloudflare', label: 'Cloudflare', host: '1.1.1.1', group: 'dns', page: 'dns' },
  { id: 'cloudflare2', label: 'Cloudflare', host: '1.0.0.1', group: 'dns', page: 'dns' },
  { id: 'google', label: 'Google DNS', host: '8.8.8.8', group: 'dns', page: 'dns' },
  { id: 'google2', label: 'Google DNS', host: '8.8.4.4', group: 'dns', page: 'dns' },
  { id: 'yandex', label: 'Yandex DNS', host: '77.88.8.8', group: 'dns', page: 'dns' },
  { id: 'yandex2', label: 'Yandex DNS', host: '77.88.8.1', group: 'dns', page: 'dns' },
  { id: 'quad9', label: 'Quad9', host: '9.9.9.9', group: 'dns', page: 'dns' },
  { id: 'adguard', label: 'AdGuard', host: '94.140.14.14', group: 'dns', page: 'dns' },

  { id: 'steam', label: 'Steam', host: 'store.steampowered.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'epic', label: 'Epic Games', host: 'www.epicgames.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'battlenet', label: 'Battle.net', host: 'eu.actual.battle.net', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'riot', label: 'Riot Client', host: 'auth.riotgames.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'ubisoft', label: 'Ubisoft', host: 'connect.ubisoft.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'ea', label: 'EA App', host: 'ea.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'xbox', label: 'Xbox', host: 'xbox.com', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'vkplay', label: 'VK Play', host: 'vkplay.ru', group: 'launcher', page: 'launchers', port: 443 },
  { id: 'discord', label: 'Discord', host: 'discord.com', group: 'launcher', page: 'launchers', port: 443 },

  { id: 'cs2', label: 'CS2', host: '155.133.230.98', group: 'game', page: 'games', hint: 'Valve Warsaw' },
  { id: 'dota2', label: 'Dota 2', host: '146.66.155.66', group: 'game', page: 'games', hint: 'Valve Vienna' },
  { id: 'valorant', label: 'Valorant', host: 'clientconfig.rpg.riotgames.com', group: 'game', page: 'games', hint: 'Riot clientconfig' },
  { id: 'lol', label: 'League of Legends', host: 'euw1.chat.si.riotgames.com', group: 'game', page: 'games', hint: 'Riot EUW chat' },
  { id: 'fortnite', label: 'Fortnite', host: 'ping-eu.ds.on.epicgames.com', group: 'game', page: 'games', hint: 'Epic Europe' },
  { id: 'apex', label: 'Apex Legends', host: 's3.eu-central-1.amazonaws.com', group: 'game', page: 'games', hint: 'EA Frankfurt' },
  { id: 'r6', label: 'Rainbow Six', host: 's3.eu-central-1.amazonaws.com', group: 'game', page: 'games', hint: 'Ubisoft Frankfurt' },
  { id: 'overwatch', label: 'Overwatch 2', host: '185.60.112.157', group: 'game', page: 'games', hint: 'Blizzard Europe' },
  { id: 'pubg', label: 'PUBG', host: 's3.eu-central-1.amazonaws.com', group: 'game', page: 'games', hint: 'Krafton Frankfurt' },

  { id: 'rust', label: 'Rust', host: '162.254.198.41', group: 'game', page: 'games', hint: 'Valve Stockholm' },
  { id: 'tarkov', label: 'Tarkov', host: '2.56.245.1', group: 'game', page: 'games', hint: 'Battlestate EU' },
  { id: 'fivem', label: 'FiveM', host: 'servers.fivem.net', group: 'game', page: 'games', port: 443, hint: 'Cfx Europe' },
  { id: 'warthunder', label: 'War Thunder', host: '92.223.8.1', group: 'game', page: 'games', hint: 'Gaijin' },
  { id: 'wot', label: 'World of Tanks', host: 'login.p1.worldoftanks.eu', group: 'game', page: 'games', hint: 'Wargaming EU' },
  { id: 'minecraft', label: 'Minecraft', host: '172.65.197.160', group: 'game', page: 'games', hint: 'Hypixel' },
  { id: 'roblox', label: 'Roblox', host: '128.116.5.3', group: 'game', page: 'games', hint: 'Roblox edge' },
  { id: 'deadlock', label: 'Deadlock', host: '162.254.196.66', group: 'game', page: 'games', hint: 'Valve London' },
  { id: 'rivals', label: 'Marvel Rivals', host: 's3.eu-central-1.amazonaws.com', group: 'game', page: 'games', hint: 'EU Frankfurt' }
]

export const PING_PAGES: { id: PingPageId; title: string }[] = [
  { id: 'dns', title: 'DNS' },
  { id: 'launchers', title: 'Лаунчеры' },
  { id: 'games', title: 'Игры' }
]

export const PING_PAGE_SIZE = 9

export const PING_OVERVIEW_IDS = ['gateway', 'cloudflare', 'google', 'yandex'] as const

export interface TrajectApi {
  minimize: () => void
  close: () => void
  getAppSettings: () => Promise<AppSettings>
  setAppSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  getNetworkInfo: () => Promise<NetworkInfo>
  ping: (target: PingTarget, count?: number) => Promise<PingResult>
  pingMany: (targets: PingTarget[], count?: number) => Promise<PingResult[]>
  onPingResult: (callback: (result: PingResult) => void) => () => void
  speedTest: () => Promise<SpeedTestResult>
  onSpeedProgress: (callback: (progress: SpeedProgress) => void) => () => void
  getSystemInfo: () => Promise<SystemInfo>
  getSystemLive: () => Promise<SystemLive>
  getMonitors: () => Promise<MonitorView[]>
  calibrateMonitors: () => Promise<MonitorView[]>
  getZapretState: () => Promise<ZapretState>
  listZapretReleases: () => Promise<ZapretRelease[]>
  downloadZapret: (tag?: string) => Promise<ZapretActionResult>
  startZapret: (strategy: string) => Promise<ZapretActionResult>
  stopZapret: () => Promise<ZapretActionResult>
  uninstallZapret: () => Promise<ZapretActionResult>
  setZapretGameFilter: (enabled: boolean) => Promise<ZapretActionResult>
  revealZapretFolder: () => Promise<ZapretActionResult>
  onZapretDownloadProgress: (callback: (progress: ZapretDownloadProgress) => void) => () => void
}

export interface ZapretDownloadProgress {
  received: number
  total: number
}

export interface ZapretActionResult {
  ok: boolean
  cancelled?: boolean
  error?: string
}

export interface ZapretRelease {
  tag: string
}

export interface ZapretStrategy {
  id: string
  file: string
  label: string
  hint: string
  recommended: boolean
}

export interface ZapretState {
  ready: boolean
  present: boolean
  running: boolean
  serviceInstalled: boolean
  serviceRunning: boolean
  version: string | null
  strategy: string | null
  activeStrategy: string | null
  gameFilter: boolean
  strategies: ZapretStrategy[]
  root: string
  error?: string
}
