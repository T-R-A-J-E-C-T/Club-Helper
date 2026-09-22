import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type { ZapretActionResult } from '@shared/types'

const execFileAsync = promisify(execFile)
const CLIENTS = ['Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment']

function updateExe(): string | null {
  const local = process.env.LOCALAPPDATA
  if (!local) return null
  for (const name of CLIENTS) {
    const exe = join(local, name, 'Update.exe')
    if (existsSync(exe)) return exe
  }
  return null
}

async function protocolCommand(): Promise<string | null> {
  for (const key of [
    'HKCU\\Software\\Classes\\discord\\shell\\open\\command',
    'HKLM\\Software\\Classes\\discord\\shell\\open\\command'
  ]) {
    try {
      const { stdout } = await execFileAsync('reg.exe', ['query', key, '/ve'], {
        timeout: 4000,
        windowsHide: true,
        encoding: 'utf8'
      })
      const match = stdout.match(/REG_SZ\s+(.+)/i)
      if (match?.[1]?.trim()) return match[1].trim()
    } catch {
      // This hive has no Discord protocol.
    }
  }
  return null
}

function commandExe(command: string): string | null {
  const quoted = command.match(/"([^"]+\.exe)"/i)
  if (quoted?.[1] && existsSync(quoted[1])) return quoted[1]
  const bare = command.match(/^[^\s]+\.exe/i)?.[0]
  if (bare && existsSync(bare)) return bare
  return null
}

function launch(file: string, args: string[]): void {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
}

export async function openDiscord(): Promise<ZapretActionResult> {
  const updater = updateExe()
  if (updater) {
    launch(updater, ['--processStart', 'Discord.exe'])
    return { ok: true }
  }

  const command = await protocolCommand()
  const exe = command ? commandExe(command) : null
  if (exe) {
    launch(exe, [])
    return { ok: true }
  }
  if (command) {
    await shell.openExternal('discord://')
    return { ok: true }
  }
  return { ok: false, error: 'Discord не найден' }
}
