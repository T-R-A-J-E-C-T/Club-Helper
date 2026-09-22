import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.ico?asset'
import type { PingTarget } from '@shared/types'
import { getNetworkInfo, getSystemInfo, getSystemLive, pingMany, pingTarget, runSpeedTest } from './diagnostics'
import { downloadZapret, getZapretState, setZapretGameFilter, startZapret, stopZapret, uninstallZapret, zapretRoot } from './zapret'
import { calibrateMonitors, listMonitors, readMonitorModes } from './monitor'

const WINDOW_WIDTH = 1280
const WINDOW_HEIGHT = 800

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
    mainWindow.show()
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('ru.traject.clubhelper')

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
  ipcMain.handle('monitor:mode', () => readMonitorModes())
  ipcMain.handle('monitor:calibrate', () => calibrateMonitors())
  ipcMain.handle('diag:ping', (_event, target: PingTarget, count?: number) =>
    pingTarget(target, count ?? 4)
  )
  ipcMain.handle('diag:ping-many', (event, targets: PingTarget[], count?: number) =>
    pingMany(targets, count ?? 4, event.sender)
  )
  ipcMain.handle('diag:speed', (event) => runSpeedTest(event.sender))
  ipcMain.handle('zapret:state', () => getZapretState())
  ipcMain.handle('zapret:download', async (event) => {
    return downloadZapret((received, total) => {
      event.sender.send('zapret:download-progress', { received, total })
    })
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
