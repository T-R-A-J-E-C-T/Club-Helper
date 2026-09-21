import { ElectronAPI } from '@electron-toolkit/preload'
import type { TrajectApi } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: TrajectApi
  }
}
