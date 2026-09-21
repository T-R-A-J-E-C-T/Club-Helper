import type { HealthLevel } from '@shared/types'

const labels: Record<HealthLevel, string> = {
  ok: 'Норма',
  warn: 'Внимание',
  bad: 'Проблема',
  unknown: 'Нет данных',
  pending: 'Проверка'
}

export function healthLabel(level: HealthLevel): string {
  return labels[level]
}

export function pingHealth(
  avgMs: number | null,
  lossPercent: number | null,
  alive: boolean,
  kind: 'net' | 'game' = 'net'
): HealthLevel {
  if (!alive || avgMs === null) return 'bad'
  const badMs = kind === 'game' ? 250 : 150
  const warnMs = kind === 'game' ? 120 : 80
  if ((lossPercent ?? 0) >= 15 || avgMs >= badMs) return 'bad'
  if ((lossPercent ?? 0) >= 5 || avgMs >= warnMs) return 'warn'
  return 'ok'
}

export function speedHealth(mbps: number | null): HealthLevel {
  if (mbps === null) return 'unknown'
  if (mbps < 5) return 'bad'
  if (mbps < 20) return 'warn'
  return 'ok'
}

export function networkHealth(opts: {
  operstate: string | null
  ipv4: string | null
  externalIp: string | null
  pingAlive?: boolean
}): HealthLevel {
  if (opts.operstate && opts.operstate !== 'up' && opts.operstate !== 'unknown') return 'bad'
  if (!opts.ipv4) return 'bad'
  if (opts.pingAlive === false && !opts.externalIp) return 'bad'
  if (!opts.externalIp) return 'warn'
  return 'ok'
}

export function bytes(value: number): string {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const digits = size >= 10 || index === 0 ? 0 : 1
  return `${size.toLocaleString('ru-RU', { maximumFractionDigits: digits })} ${units[index]}`
}

export function gib(value: number): string {
  return `${(value / 1024 ** 3).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} ГБ`
}

export function ghz(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ГГц`
}

export function ms(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value)} мс`
}

export function uptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} д ${hours} ч`
  if (hours > 0) return `${hours} ч ${minutes} мин`
  return `${minutes} мин`
}

export function ifaceType(type: string | null): string {
  if (!type) return 'адаптер'
  const value = type.toLowerCase()
  if (value.includes('wireless') || value.includes('wifi') || value === 'wlan') return 'Wi‑Fi'
  if (value.includes('wired') || value.includes('ethernet')) return 'Ethernet'
  return type
}
