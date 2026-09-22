import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppSettings } from '@shared/types'

const DEFAULTS: AppSettings = {
  openAtLogin: false,
  startInTray: false
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readAppSettings(): Promise<AppSettings> {
  try {
    const parsed = JSON.parse(await readFile(settingsFile(), 'utf8')) as Partial<AppSettings>
    return {
      openAtLogin: Boolean(parsed.openAtLogin),
      startInTray: Boolean(parsed.startInTray)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function writeAppSettings(next: AppSettings): Promise<void> {
  const file = settingsFile()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(next), 'utf8')
}

export function applyOpenAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return
  const path = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path
  })
}

export function mergeAppSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    openAtLogin: typeof patch.openAtLogin === 'boolean' ? patch.openAtLogin : current.openAtLogin,
    startInTray: typeof patch.startInTray === 'boolean' ? patch.startInTray : current.startInTray
  }
}
