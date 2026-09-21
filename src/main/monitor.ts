import { spawn } from 'node:child_process'
// Vite inlines the PowerShell calibrator; tsc has no loader for the raw query.
// @ts-expect-error raw script import
import scriptSource from './monitor.ps1?raw'
import type { MonitorView } from '@shared/types'

type Action = 'list' | 'calibrate'

function scriptBody(action: Action): string {
  return scriptSource.replace('__ACTION__', action)
}

function run(action: Action): Promise<MonitorView[]> {
  const script = scriptBody(action)
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
      { windowsHide: true }
    )
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Монитор не ответил'))
    }, 45000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      out += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      err += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const line = out
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item.startsWith('[') || item.startsWith('{'))
        .pop()
      if (!line) {
        reject(new Error(err.trim() || `Не удалось прочитать мониторы (${code ?? 'нет кода'})`))
        return
      }
      try {
        const parsed = JSON.parse(line) as MonitorView | MonitorView[]
        const list = Array.isArray(parsed) ? parsed : [parsed]
        resolve(
          list.map((item) => ({
            ...item,
            resolution: item.resolution.replace(/x/i, '×'),
            steps: Array.isArray(item.steps) ? item.steps : item.steps ? [item.steps] : []
          }))
        )
      } catch {
        reject(new Error('Монитор вернул непонятный ответ'))
      }
    })
    child.stdin.write(script)
    child.stdin.end()
  })
}

export function listMonitors(): Promise<MonitorView[]> {
  return run('list')
}

export function calibrateMonitors(): Promise<MonitorView[]> {
  return run('calibrate')
}
