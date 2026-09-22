import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  PingResult,
  PingTarget,
  SpeedProgress,
  TrajectApi,
  ZapretDownloadProgress
} from '@shared/types'

const api: TrajectApi = {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  setAppSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  openDiscord: () => ipcRenderer.invoke('discord:open'),
  getNetworkInfo: () => ipcRenderer.invoke('diag:network'),
  ping: (target, count) => ipcRenderer.invoke('diag:ping', target, count),
  pingMany: (targets: PingTarget[], count?: number) =>
    ipcRenderer.invoke('diag:ping-many', targets, count),
  onPingResult: (callback: (result: PingResult) => void) => {
    const listener = (_event: unknown, result: PingResult): void => callback(result)
    ipcRenderer.on('diag:ping-result', listener)
    return () => {
      ipcRenderer.removeListener('diag:ping-result', listener)
    }
  },
  speedTest: () => ipcRenderer.invoke('diag:speed'),
  onSpeedProgress: (callback: (progress: SpeedProgress) => void) => {
    const listener = (_event: unknown, progress: SpeedProgress): void => callback(progress)
    ipcRenderer.on('diag:speed-progress', listener)
    return () => {
      ipcRenderer.removeListener('diag:speed-progress', listener)
    }
  },
  getSystemInfo: () => ipcRenderer.invoke('diag:system'),
  getSystemLive: () => ipcRenderer.invoke('diag:system-live'),
  getMonitors: () => ipcRenderer.invoke('monitor:list'),
  calibrateMonitors: () => ipcRenderer.invoke('monitor:calibrate'),
  getZapretState: () => ipcRenderer.invoke('zapret:state'),
  listZapretReleases: () => ipcRenderer.invoke('zapret:releases'),
  downloadZapret: (tag?: string) => ipcRenderer.invoke('zapret:download', tag),
  startZapret: (strategy: string) => ipcRenderer.invoke('zapret:start', strategy),
  stopZapret: () => ipcRenderer.invoke('zapret:stop'),
  uninstallZapret: () => ipcRenderer.invoke('zapret:uninstall'),
  setZapretGameFilter: (enabled: boolean) => ipcRenderer.invoke('zapret:game-filter', enabled),
  revealZapretFolder: () => ipcRenderer.invoke('zapret:reveal'),
  onZapretDownloadProgress: (callback: (progress: ZapretDownloadProgress) => void) => {
    const listener = (_event: unknown, progress: ZapretDownloadProgress): void => callback(progress)
    ipcRenderer.on('zapret:download-progress', listener)
    return () => {
      ipcRenderer.removeListener('zapret:download-progress', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore context isolation off
  window.electron = electronAPI
  // @ts-ignore context isolation off
  window.api = api
}
