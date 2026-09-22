import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, shell, Tray } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.ico?asset'
import type { AppSettings, PingTarget } from '@shared/types'
import { getNetworkInfo, getSystemInfo, getSystemLive, pingMany, pingTarget, runSpeedTest } from './diagnostics'
import { downloadZapret, getZapretState, listZapretReleases, setZapretGameFilter, startZapret, stopZapret, uninstallZapret, zapretRoot } from './zapret'
import { calibrateMonitors, listMonitors } from './monitor'
import { openDiscord } from './discord'
import { applyOpenAtLogin, mergeAppSettings, readAppSettings, writeAppSettings } from './settings'

const WINDOW_WIDTH = 1280
const WINDOW_HEIGHT = 800

let launchSettings: AppSettings = { openAtLogin: true, startInTray: true, openDiscord: true }
let tray: Tray | null = null
let quitting = false
let trayBusy = false
let tipTimer: ReturnType<typeof setTimeout> | null = null

function showMainWindow(): void {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.setSkipTaskbar(false)
  mainWindow.show()
  mainWindow.focus()
}

function notifyRenderer(channel: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel)
  }
}

function setTrayTip(text: string, temporary = false): void {
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = null
  tray?.setToolTip(text)
  if (!temporary) return
  tipTimer = setTimeout(() => tray?.setToolTip('Traject Club Helper'), 4000)
}

async function trayInstallZapret(): Promise<void> {
  if (trayBusy) return
  trayBusy = true
  setTrayTip('Скачиваем запрет…')
  try {
    const downloaded = await downloadZapret()
    if (!downloaded.ok) {
      setTrayTip(downloaded.error || 'Не удалось скачать запрет', true)
      return
    }
    notifyRenderer('zapret:refresh')
    setTrayTip('Traject Club Helper')
  } catch (error) {
    setTrayTip(error instanceof Error ? error.message : 'Не удалось скачать запрет', true)
  } finally {
    trayBusy = false
  }
}

async function trayStartZapret(): Promise<void> {
  if (trayBusy) return
  trayBusy = true
  setTrayTip('Запускаем обход…')
  try {
    let state = await getZapretState()
    if (!state.ready) {
      setTrayTip('Скачиваем запрет…')
      const downloaded = await downloadZapret()
      if (!downloaded.ok) {
        setTrayTip(downloaded.error || 'Не удалось скачать запрет', true)
        return
      }
      state = await getZapretState()
      if (!state.ready) {
        setTrayTip('Не удалось установить запрет', true)
        return
      }
    }
    if (!state.running) {
      const file = state.strategies.find((item) => /alt\s*11/i.test(item.file))?.file || 'general (ALT11).bat'
      const started = await startZapret(file)
      if (!started.ok) {
        setTrayTip(started.cancelled ? 'Нужны права администратора' : started.error || 'Не удалось включить обход', true)
        return
      }
    }
    notifyRenderer('zapret:refresh')
    if (launchSettings.openDiscord) {
      const opened = await openDiscord()
      if (!opened.ok) {
        setTrayTip(opened.error || 'Discord не найден', true)
        return
      }
    }
    setTrayTip('Traject Club Helper')
  } catch (error) {
    setTrayTip(error instanceof Error ? error.message : 'Не удалось включить обход', true)
  } finally {
    trayBusy = false
  }
}

async function trayCalibrate(): Promise<void> {
  if (trayBusy) return
  trayBusy = true
  setTrayTip('Сбрасываем монитор…')
  try {
    await calibrateMonitors()
    notifyRenderer('monitor:refresh')
    setTrayTip('Traject Club Helper')
  } catch (error) {
    setTrayTip(error instanceof Error ? error.message : 'Монитор не ответил', true)
  } finally {
    trayBusy = false
  }
}

async function openTrayMenu(): Promise<void> {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: 'Открыть', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Установить запрет', enabled: !trayBusy, click: () => void trayInstallZapret() },
    { label: 'Запустить запрет', enabled: !trayBusy, click: () => void trayStartZapret() },
    { label: 'Сбросить монитор', enabled: !trayBusy, click: () => void trayCalibrate() },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ])
  tray.popUpContextMenu(menu)
}

function syncTray(enabled: boolean): void {
  if (!enabled) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return
  tray = new Tray(nativeImage.createFromPath(icon))
  tray.setToolTip('Traject Club Helper')
  tray.on('click', () => showMainWindow())
  tray.on('right-click', () => {
    void openTrayMenu()
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: launchSettings.startInTray,
    backgroundColor: '#16140f',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!launchSettings.startInTray) mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    if (quitting || !launchSettings.startInTray) return
    event.preventDefault()
    mainWindow.setSkipTaskbar(true)
    mainWindow.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const hasInstanceLock = !app.isPackaged || app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
}

app.on('before-quit', () => {
  quitting = true
})

if (hasInstanceLock) app.whenReady().then(async () => {
  electronApp.setAppUserModelId('ru.traject.clubhelper')
  launchSettings = await readAppSettings()
  applyOpenAtLogin(launchSettings.openAtLogin)
  syncTray(launchSettings.startInTray)

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    return permission === 'media'
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('diag:network', () => getNetworkInfo())
  ipcMain.handle('diag:system', () => getSystemInfo())
  ipcMain.handle('diag:system-live', () => getSystemLive())
  ipcMain.handle('monitor:list', () => listMonitors())
  ipcMain.handle('monitor:calibrate', () => calibrateMonitors())
  ipcMain.handle('diag:ping', (_event, target: PingTarget, count?: number) =>
    pingTarget(target, count ?? 4)
  )
  ipcMain.handle('diag:ping-many', (event, targets: PingTarget[], count?: number) =>
    pingMany(targets, count ?? 4, event.sender)
  )
  ipcMain.handle('diag:speed', (event) => runSpeedTest(event.sender))
  ipcMain.handle('zapret:state', () => getZapretState())
  ipcMain.handle('zapret:releases', () => listZapretReleases())
  ipcMain.handle('zapret:download', async (event, tag?: string) => {
    const chosen = typeof tag === 'string' && tag.trim() ? tag.trim() : undefined
    return downloadZapret((received, total) => {
      event.sender.send('zapret:download-progress', { received, total })
    }, chosen)
  })
  ipcMain.handle('zapret:start', (_event, strategy: string) => startZapret(strategy))
  ipcMain.handle('zapret:stop', () => stopZapret())
  ipcMain.handle('zapret:uninstall', () => uninstallZapret())
  ipcMain.handle('zapret:game-filter', (_event, enabled: boolean) => setZapretGameFilter(enabled))
  ipcMain.handle('zapret:reveal', async () => {
    const root = zapretRoot()
    await mkdir(root, { recursive: true })
    const error = await shell.openPath(root)
    return error ? { ok: false, error } : { ok: true }
  })
  ipcMain.handle('settings:get', () => launchSettings)
  ipcMain.handle('discord:open', () => openDiscord())
  ipcMain.handle('settings:set', async (_event, patch: Partial<AppSettings>) => {
    launchSettings = mergeAppSettings(launchSettings, patch)
    await writeAppSettings(launchSettings)
    applyOpenAtLogin(launchSettings.openAtLogin)
    syncTray(launchSettings.startInTray)
    if (!launchSettings.startInTray) showMainWindow()
    return launchSettings
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (launchSettings.startInTray) return
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
