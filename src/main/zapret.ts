import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, rm, cp, access, readdir, unlink } from 'node:fs/promises'
import type { IncomingHttpHeaders } from 'node:http'
import https from 'node:https'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { ZapretActionResult, ZapretState, ZapretStrategy } from '@shared/types'

const execFileAsync = promisify(execFile)
const GITHUB_API = 'https://api.github.com/repos/Flowseal/zapret-discord-youtube/releases/latest'
const USER_AGENT = 'TrajectClubHelper'
const PRESERVE = [
  'lists/list-general-user.txt',
  'lists/list-exclude-user.txt',
  'lists/ipset-exclude-user.txt',
  'utils/game_filter.enabled',
  'traject.json'
]

interface ZapretConfig {
  strategy: string
  gameFilter: boolean
}

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GithubRelease {
  tag_name: string
  assets: ReleaseAsset[]
}

const STRATEGY_HINTS: Record<string, { label: string; hint: string; recommended?: boolean }> = {
  'general.bat': {
    label: 'Основная',
    hint: 'Начните с неё: Discord, YouTube и остальные списки',
    recommended: true
  },
  'general (ALT).bat': {
    label: 'ALT',
    hint: 'Если основная не открывает сайты у вашего провайдера',
    recommended: true
  },
  'general (FAKE TLS AUTO).bat': {
    label: 'Fake TLS Auto',
    hint: 'Часто выручает, когда ALT уже не справляется',
    recommended: true
  },
  'general (SIMPLE FAKE).bat': {
    label: 'Simple Fake',
    hint: 'Мягкий вариант, меньше затрагивает остальной трафик',
    recommended: true
  },
  'general (EXP).bat': { label: 'Экспериментальная', hint: 'Новые параметры, может быть нестабильно' }
}

export function zapretRoot(): string {
  return join(helperRoot(), 'zapret')
}

function helperRoot(): string {
  return join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'TrajectClubHelper')
}

function elevateDir(): string {
  return join(tmpdir(), 'TrajectClubHelper')
}

function elevateLog(): string {
  return join(elevateDir(), 'traject-elevate.log')
}

async function ensureElevateDir(): Promise<void> {
  await mkdir(elevateDir(), { recursive: true })
}

function binDir(): string {
  return join(zapretRoot(), 'bin')
}

function listsDir(): string {
  return join(zapretRoot(), 'lists')
}

function configPath(): string {
  return join(zapretRoot(), 'traject.json')
}

function winwsPath(): string {
  return join(binDir(), 'winws.exe')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readConfig(): Promise<ZapretConfig> {
  try {
    const raw = await readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ZapretConfig>
    return {
      strategy: parsed.strategy || 'general.bat',
      gameFilter: Boolean(parsed.gameFilter)
    }
  } catch {
    return { strategy: 'general.bat', gameFilter: false }
  }
}

async function writeConfig(config: ZapretConfig): Promise<void> {
  await mkdir(zapretRoot(), { recursive: true })
  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

function strategyMeta(file: string): ZapretStrategy {
  const known = STRATEGY_HINTS[file]
  if (known) {
    return {
      id: file,
      file,
      label: known.label,
      hint: known.hint,
      recommended: Boolean(known.recommended)
    }
  }
  const inner = file.replace(/^general\s*/i, '').replace(/\.bat$/i, '').replace(/[()]/g, '').trim()
  const alt = inner.match(/^ALT\s*(\d+)$/i)
  return {
    id: file,
    file,
    label: alt ? `ALT ${alt[1]}` : inner || file,
    hint: 'Альтернативная стратегия обхода DPI',
    recommended: false
  }
}

function matchStrategy(strategies: ZapretStrategy[], wanted: string): ZapretStrategy | undefined {
  const exact = strategies.find((item) => item.file === wanted)
  if (exact) return exact
  if (/alt\s*11/i.test(wanted)) {
    return strategies.find((item) => /alt\s*11/i.test(item.file))
  }
  const compact = wanted.replace(/[()]/g, '').toLowerCase()
  return (
    strategies.find((item) => item.file.replace(/[()]/g, '').toLowerCase() === compact) ??
    strategies[0]
  )
}

async function listStrategies(): Promise<ZapretStrategy[]> {
  const root = zapretRoot()
  if (!(await exists(root))) return []
  const entries = await readdir(root)
  const files = entries.filter(
    (name) => name.toLowerCase().endsWith('.bat') && !name.toLowerCase().startsWith('service')
  )
  const items = files.map(strategyMeta)
  items.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
    if (a.file === 'general.bat') return -1
    if (b.file === 'general.bat') return 1
    return a.label.localeCompare(b.label, 'ru')
  })
  return items
}

async function readVersion(): Promise<string | null> {
  try {
    const bat = await readFile(join(zapretRoot(), 'service.bat'), 'utf8')
    const match = bat.match(/LOCAL_VERSION=([0-9.]+)/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

async function queryService(name: string): Promise<{ installed: boolean; running: boolean }> {
  try {
    const { stdout } = await execFileAsync('sc.exe', ['query', name], {
      timeout: 5000,
      windowsHide: true,
      encoding: 'utf8'
    })
    const running = /STATE\s*:\s*\d+\s+RUNNING/i.test(stdout)
    return { installed: true, running }
  } catch {
    return { installed: false, running: false }
  }
}

async function isWinwsRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FI', 'IMAGENAME eq winws.exe', '/FO', 'CSV', '/NH'], {
      timeout: 5000,
      windowsHide: true,
      encoding: 'utf8'
    })
    return /winws\.exe/i.test(stdout)
  } catch {
    return false
  }
}

async function readActiveStrategy(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'reg.exe',
      ['query', 'HKLM\\System\\CurrentControlSet\\Services\\zapret', '/v', 'zapret-discord-youtube'],
      { timeout: 4000, windowsHide: true, encoding: 'utf8' }
    )
    const match = stdout.match(/zapret-discord-youtube\s+REG_SZ\s+(.+)/i)
    const value = match?.[1]?.trim()
    if (!value) return null
    return value.toLowerCase().endsWith('.bat') ? value : `${value}.bat`
  } catch {
    return null
  }
}

function gameFilterEnabled(): Promise<boolean> {
  return exists(join(zapretRoot(), 'utils', 'game_filter.enabled'))
}

async function folderHasEntries(path: string): Promise<boolean> {
  try {
    return (await readdir(path)).length > 0
  } catch {
    return false
  }
}

export async function getZapretState(): Promise<ZapretState> {
  const root = zapretRoot()
  const ready = await exists(winwsPath())
  const config = await readConfig()
  const [service, running, activeStrategy, version, strategies, gameFilter, leftover] = await Promise.all([
    queryService('zapret'),
    isWinwsRunning(),
    readActiveStrategy(),
    readVersion(),
    ready ? listStrategies() : Promise.resolve([]),
    gameFilterEnabled(),
    folderHasEntries(root)
  ])

  return {
    ready,
    present: ready || leftover || service.installed || running,
    running,
    serviceInstalled: service.installed,
    serviceRunning: service.running,
    version,
    strategy: config.strategy,
    activeStrategy,
    gameFilter,
    strategies,
    root
  }
}

async function ensureUserLists(): Promise<void> {
  const lists = listsDir()
  await mkdir(lists, { recursive: true })
  const files: Array<[string, string]> = [
    ['ipset-exclude-user.txt', '203.0.113.113/32\n'],
    ['list-general-user.txt', '# Never leave this file empty\ndomain.example.abc\n'],
    ['list-exclude-user.txt', 'domain.example.abc\n']
  ]
  for (const [name, body] of files) {
    const path = join(lists, name)
    if (!(await exists(path))) await writeFile(path, body, 'utf8')
  }
}

async function writeGameFilter(enabled: boolean): Promise<void> {
  const utils = join(zapretRoot(), 'utils')
  await mkdir(utils, { recursive: true })
  const flag = join(utils, 'game_filter.enabled')
  if (enabled) {
    await writeFile(flag, 'mode=all\ntcp=1024-65535\nudp=1024-65535\n', 'utf8')
  } else if (await exists(flag)) {
    await unlink(flag)
  }
}

function expandBatVars(content: string, gameTcp: string, gameUdp: string): string {
  const root = zapretRoot().endsWith('\\') ? zapretRoot() : `${zapretRoot()}\\`
  const bin = binDir().endsWith('\\') ? binDir() : `${binDir()}\\`
  const lists = listsDir().endsWith('\\') ? listsDir() : `${listsDir()}\\`
  return content
    .replace(/%~dp0bin\\/gi, bin)
    .replace(/%~dp0/gi, root)
    .replace(/%BIN%/gi, bin)
    .replace(/%LISTS%/gi, lists)
    .replace(/%GameFilterTCP%/gi, gameTcp)
    .replace(/%GameFilterUDP%/gi, gameUdp)
    .replace(/%GameFilter%/gi, gameTcp)
}

function extractWinwsCommand(bat: string): string | null {
  const lines = bat.split(/\r?\n/)
  const chunks: string[] = []
  let capturing = false
  for (const line of lines) {
    const raw = line.replace(/^\s+/, '')
    if (!capturing) {
      if (!/winws\.exe/i.test(raw)) continue
      capturing = true
      const cont = raw.trimEnd().endsWith('^')
      chunks.push(cont ? raw.trimEnd().slice(0, -1) : raw)
      if (!cont) break
      continue
    }
    const cont = raw.trimEnd().endsWith('^')
    chunks.push(cont ? raw.trimEnd().slice(0, -1) : raw)
    if (!cont) break
  }
  const command = chunks.join(' ').replace(/\s+/g, ' ').trim()
  return command || null
}

function argsFromWinwsCommand(command: string): string {
  const match = command.match(/winws\.exe"?(?:\s+(.*))?$/i)
  return (match?.[1] ?? '').trim()
}

async function buildStrategyArgs(file: string, gameFilter: boolean): Promise<string> {
  const batPath = join(zapretRoot(), file)
  if (!(await exists(batPath))) {
    throw new Error(`Стратегия ${file} не найдена`)
  }
  const raw = await readFile(batPath, 'utf8')
  const gameTcp = gameFilter ? '1024-65535' : '12'
  const gameUdp = gameFilter ? '1024-65535' : '12'
  const expanded = expandBatVars(raw, gameTcp, gameUdp)
  const command = extractWinwsCommand(expanded)
  if (!command) throw new Error('В стратегии нет запуска winws.exe')
  const args = argsFromWinwsCommand(command)
    .replace(/\^!/g, '!')
    .replace(/\^\^/g, '^')
  if (!args) throw new Error('Не удалось прочитать параметры стратегии')
  return args
}

function toScBinPath(winws: string, args: string): string {
  const escapedArgs = args.replace(/"/g, '\\"')
  return `"\\"${winws}\\" ${escapedArgs}"`
}

async function runElevated(scriptPath: string): Promise<{ code: number; cancelled: boolean }> {
  const escaped = scriptPath.replace(/'/g, "''")
  const command = [
    `$code = 1223`,
    `try {`,
    `  $p = Start-Process -FilePath '${escaped}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden`,
    `  if ($null -ne $p) { $code = $p.ExitCode }`,
    `} catch { $code = 1223 }`,
    `exit $code`
  ].join('; ')

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      timeout: 120000,
      windowsHide: true,
      encoding: 'utf8'
    })
    return { code: 0, cancelled: false }
  } catch (error) {
    const err = error as { status?: number; code?: number | string }
    const status = typeof err.status === 'number' ? err.status : Number(err.code)
    if (status === 1223) return { code: 1223, cancelled: true }
    if (Number.isFinite(status)) return { code: status, cancelled: false }
    return { code: 1, cancelled: false }
  }
}

async function writeStartScript(winws: string, args: string, strategyName: string): Promise<string> {
  await ensureElevateDir()
  const log = elevateLog()
  const script = join(elevateDir(), 'traject-start.cmd')
  const binPath = toScBinPath(winws, args)
  const name = strategyName.replace(/\.bat$/i, '')
  const body = [
    '@echo off',
    'setlocal',
    `> "${log}" echo start %date% %time%`,
    'netsh interface tcp set global timestamps=enabled >nul 2>&1',
    'sc stop zapret >> "' + log + '" 2>&1',
    'sc delete zapret >> "' + log + '" 2>&1',
    'taskkill /IM winws.exe /F >> "' + log + '" 2>&1',
    `sc create zapret binPath= ${binPath} DisplayName= "zapret" start= auto >> "${log}" 2>&1`,
    'if errorlevel 1 exit /b 1',
    'sc description zapret "Zapret DPI bypass software" >> "' + log + '" 2>&1',
    'sc start zapret >> "' + log + '" 2>&1',
    'if errorlevel 1 exit /b 1',
    `reg add "HKLM\\System\\CurrentControlSet\\Services\\zapret" /v zapret-discord-youtube /t REG_SZ /d "${name}" /f >> "${log}" 2>&1`,
    'exit /b 0',
    ''
  ].join('\r\n')
  await writeFile(script, body, 'utf8')
  return script
}

async function writeStopScript(): Promise<string> {
  await ensureElevateDir()
  const log = elevateLog()
  const script = join(elevateDir(), 'traject-stop.cmd')
  const body = [
    '@echo off',
    'setlocal',
    `> "${log}" echo stop %date% %time%`,
    'sc stop zapret >> "' + log + '" 2>&1',
    'sc delete zapret >> "' + log + '" 2>&1',
    'taskkill /IM winws.exe /F >> "' + log + '" 2>&1',
    'sc stop WinDivert >> "' + log + '" 2>&1',
    'sc delete WinDivert >> "' + log + '" 2>&1',
    'sc stop WinDivert14 >> "' + log + '" 2>&1',
    'sc delete WinDivert14 >> "' + log + '" 2>&1',
    'exit /b 0',
    ''
  ].join('\r\n')
  await writeFile(script, body, 'utf8')
  return script
}

async function writeUninstallScript(): Promise<string> {
  await ensureElevateDir()
  const log = elevateLog()
  const script = join(elevateDir(), 'traject-uninstall.cmd')
  const root = zapretRoot()
  const parent = helperRoot()
  const body = [
    '@echo off',
    'setlocal',
    'cd /d "%TEMP%"',
    `> "${log}" echo uninstall %date% %time%`,
    'sc stop zapret >> "' + log + '" 2>&1',
    'sc delete zapret >> "' + log + '" 2>&1',
    'taskkill /IM winws.exe /F >> "' + log + '" 2>&1',
    'sc stop WinDivert >> "' + log + '" 2>&1',
    'sc delete WinDivert >> "' + log + '" 2>&1',
    'sc stop WinDivert14 >> "' + log + '" 2>&1',
    'sc delete WinDivert14 >> "' + log + '" 2>&1',
    'ping 127.0.0.1 -n 2 >nul',
    `rmdir /s /q "${root}" >> "${log}" 2>&1`,
    `rmdir "${parent}" >> "${log}" 2>&1`,
    'exit /b 0',
    ''
  ].join('\r\n')
  await writeFile(script, body, 'utf8')
  return script
}

async function readElevateLog(): Promise<string> {
  try {
    const text = await readFile(elevateLog(), 'utf8')
    return text.trim().split(/\r?\n/).slice(-8).join('\n')
  } catch {
    return ''
  }
}

export async function startZapret(strategyFile: string): Promise<ZapretActionResult> {
  if (!(await exists(winwsPath()))) {
    return { ok: false, error: 'Сначала скачайте zapret' }
  }
  const strategies = await listStrategies()
  const chosen = matchStrategy(strategies, strategyFile)
  if (!chosen) return { ok: false, error: 'Нет нужной стратегии. Обновите файлы обхода.' }

  const config = await readConfig()
  await writeGameFilter(config.gameFilter)
  await ensureUserLists()

  let args: string
  try {
    args = await buildStrategyArgs(chosen.file, config.gameFilter)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Не удалось разобрать стратегию' }
  }

  await writeConfig({ ...config, strategy: chosen.file })
  const script = await writeStartScript(winwsPath(), args, chosen.file)
  const result = await runElevated(script)
  if (result.cancelled) {
    return { ok: false, cancelled: true, error: 'Нужны права администратора' }
  }
  if (result.code !== 0) {
    const log = await readElevateLog()
    return { ok: false, error: log || `Не удалось включить обход (код ${result.code})` }
  }

  const running = await waitFor(() => isWinwsRunning(), 8000)
  if (!running) {
    const log = await readElevateLog()
    return { ok: false, error: log || 'Служба создана, но winws.exe не запустился. Проверьте антивирус.' }
  }
  return { ok: true }
}

export async function stopZapret(): Promise<ZapretActionResult> {
  const script = await writeStopScript()
  const result = await runElevated(script)
  if (result.cancelled) {
    return { ok: false, cancelled: true, error: 'Нужны права администратора' }
  }
  if (result.code !== 0) {
    const log = await readElevateLog()
    return { ok: false, error: log || `Не удалось выключить обход (код ${result.code})` }
  }
  return { ok: true }
}

export async function uninstallZapret(): Promise<ZapretActionResult> {
  const root = zapretRoot()
  const parent = helperRoot()
  const script = await writeUninstallScript()
  const result = await runElevated(script)
  if (result.cancelled) {
    return { ok: false, cancelled: true, error: 'Нужны права администратора' }
  }

  await new Promise((resolve) => setTimeout(resolve, 400))
  if (await folderHasEntries(root)) {
    try {
      await rm(root, { recursive: true, force: true })
    } catch {
      return { ok: false, error: 'Не удалось удалить файлы обхода. Попробуйте ещё раз.' }
    }
  }

  try {
    const leftover = await readdir(parent)
    if (!leftover.length) await rm(parent, { recursive: true, force: true })
  } catch {
    // каталог родителя ещё используется
  }

  if (await folderHasEntries(root)) {
    return { ok: false, error: 'Не удалось удалить файлы обхода. Попробуйте ещё раз.' }
  }

  return { ok: true }
}

export async function setZapretGameFilter(enabled: boolean): Promise<ZapretActionResult> {
  if (!(await exists(winwsPath()))) {
    return { ok: false, error: 'Сначала скачайте zapret' }
  }
  const config = await readConfig()
  await writeConfig({ ...config, gameFilter: enabled })
  await writeGameFilter(enabled)
  if (await isWinwsRunning()) {
    return startZapret(config.strategy)
  }
  return { ok: true }
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return check()
}

function httpsGet(
  url: string,
  accept: string
): Promise<{ status: number; headers: IncomingHttpHeaders; stream: NodeJS.ReadableStream }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept
        },
        timeout: 60000
      },
      (res) => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, stream: res })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Превышено время ожидания'))
    })
  })
}

async function readJson<T>(url: string): Promise<T> {
  const response = await follow(url, 'application/vnd.github+json')
  const chunks: Buffer[] = []
  for await (const chunk of response.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

async function follow(
  url: string,
  accept: string,
  hops = 0
): Promise<{ status: number; headers: IncomingHttpHeaders; stream: NodeJS.ReadableStream }> {
  if (hops > 6) throw new Error('Слишком много редиректов')
  const response = await httpsGet(url, accept)
  if (response.status >= 300 && response.status < 400 && response.headers.location) {
    response.stream.resume()
    const next = response.headers.location.startsWith('http')
      ? response.headers.location
      : new URL(response.headers.location, url).toString()
    return follow(next, accept, hops + 1)
  }
  if (response.status >= 400) {
    response.stream.resume()
    throw new Error(`GitHub ответил ${response.status}`)
  }
  return response
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (received: number, total: number) => void
): Promise<void> {
  const response = await follow(url, 'application/octet-stream')
  const total = Number(response.headers['content-length'] || 0)
  await mkdir(dirname(dest), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(dest)
    let received = 0
    response.stream.on('data', (chunk: Buffer) => {
      received += chunk.length
      onProgress?.(received, total)
    })
    response.stream.pipe(file)
    file.on('finish', () => file.close(() => resolve()))
    file.on('error', reject)
    response.stream.on('error', reject)
  })
}

async function findExtractRoot(extractDir: string): Promise<string> {
  if (await exists(join(extractDir, 'bin', 'winws.exe'))) return extractDir
  const entries = await readdir(extractDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = join(extractDir, entry.name)
    if (await exists(join(nested, 'bin', 'winws.exe'))) return nested
  }
  throw new Error('В архиве нет bin\\winws.exe')
}

export async function downloadZapret(
  onProgress?: (received: number, total: number) => void
): Promise<ZapretActionResult> {
  try {
    const release = await readJson<GithubRelease>(GITHUB_API)
    const asset =
      release.assets.find((item) => item.name.toLowerCase().endsWith('.zip')) ??
      release.assets.find((item) => item.name.toLowerCase().endsWith('.tar.gz'))
    if (!asset) return { ok: false, error: 'В релизе нет архива' }

    const zipPath = join(tmpdir(), asset.name)
    const extractDir = join(tmpdir(), 'traject-zapret-extract')
    await downloadFile(asset.browser_download_url, zipPath, onProgress)
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', `Unblock-File -LiteralPath '${zipPath.replace(/'/g, "''")}'`],
      { timeout: 15000, windowsHide: true }
    ).catch(() => undefined)

    await rm(extractDir, { recursive: true, force: true })
    await mkdir(extractDir, { recursive: true })
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
      ],
      { timeout: 60000, windowsHide: true }
    )

    const source = await findExtractRoot(extractDir)
    const target = zapretRoot()
    const saved = new Map<string, Buffer>()
    for (const rel of PRESERVE) {
      try {
        saved.set(rel, await readFile(join(target, rel)))
      } catch {
        // first install
      }
    }

    await mkdir(target, { recursive: true })
    await cp(source, target, { recursive: true, force: true })
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-ChildItem -LiteralPath '${target.replace(/'/g, "''")}' -Recurse | Unblock-File`
      ],
      { timeout: 20000, windowsHide: true }
    ).catch(() => undefined)

    for (const [rel, buf] of saved) {
      await mkdir(dirname(join(target, rel)), { recursive: true })
      await writeFile(join(target, rel), buf)
    }
    await ensureUserLists()
    const config = await readConfig()
    await writeConfig(config)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Не удалось скачать zapret' }
  }
}
