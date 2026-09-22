import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  PING_OVERVIEW_IDS,
  PING_TARGETS,
  type GpuInfo,
  type NetworkInfo,
  type PingResult,
  type PingTarget,
  type SpeedProgress,
  type SpeedTestResult,
  type MonitorView,
  type SystemInfo,
  type SystemLive
} from '@shared/types'
import { listAudioDevices } from '@renderer/lib/audio'

export interface AudioSnapshot {
  inputs: number
  outputs: number
  inputLabel: string | null
  outputLabel: string | null
  error: string | null
}

export interface SpeedSnapshot {
  result: { mbps: number; bytes: number; durationMs: number } | null
  live: { mbps: number; bytes: number } | null
  progress: number
  running: boolean
  error: string | null
}

interface DiagnosticsState {
  network: NetworkInfo | null
  system: SystemInfo | null
  pings: Record<string, PingResult>
  audio: AudioSnapshot
  speed: SpeedSnapshot
  monitors: MonitorView[] | null
  monitorError: string | null
  calibrating: boolean
  loading: boolean
  pinging: boolean
  pendingPings: Record<string, true>
  error: string | null
  refreshAll: () => Promise<void>
  refreshNetwork: () => Promise<void>
  refreshSystem: () => Promise<void>
  refreshAudio: () => Promise<void>
  refreshMonitors: () => Promise<void>
  calibrateMonitors: () => Promise<void>
  runPings: (count?: number, targets?: PingTarget[]) => Promise<void>
  runSpeedTest: () => Promise<void>
}

const DiagnosticsContext = createContext<DiagnosticsState | null>(null)

const emptyAudio: AudioSnapshot = {
  inputs: 0,
  outputs: 0,
  inputLabel: null,
  outputLabel: null,
  error: null
}

const emptySpeed: SpeedSnapshot = {
  result: null,
  live: null,
  progress: 0,
  running: false,
  error: null
}

const overviewIds = new Set<string>(PING_OVERVIEW_IDS)
const OVERVIEW_TARGETS = PING_TARGETS.filter((target) => overviewIds.has(target.id))
const BACKGROUND_TARGETS = PING_TARGETS.filter((target) => !overviewIds.has(target.id))

function gpuNamesClose(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left.includes(right) || right.includes(left)
}

function applySystemLive(system: SystemInfo, live: SystemLive): SystemInfo {
  const gpus: GpuInfo[] = system.gpus.length
    ? system.gpus.map((gpu, index) => {
        const match =
          live.gpus.find((item) => gpuNamesClose(item.model, gpu.model)) ??
          (live.gpus.length === system.gpus.length ? live.gpus[index] : null)
        if (!match) return gpu
        return {
          ...gpu,
          usagePercent: match.usagePercent,
          temp: match.temp,
          memoryUsedMb: match.memoryUsedMb,
          vramMb: match.vramMb ?? gpu.vramMb
        }
      })
    : live.gpus

  return {
    ...system,
    loadPercent: live.loadPercent,
    cpuTemp: live.cpuTemp,
    mem: live.mem,
    uptimeSec: live.uptimeSec,
    cpu: {
      ...system.cpu,
      speedGHz: live.cpuSpeedGHz ?? system.cpu.speedGHz
    },
    gpus
  }
}

export function DiagnosticsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [network, setNetwork] = useState<NetworkInfo | null>(null)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [pings, setPings] = useState<Record<string, PingResult>>({})
  const [audio, setAudio] = useState<AudioSnapshot>(emptyAudio)
  const [speed, setSpeed] = useState<SpeedSnapshot>(emptySpeed)
  const [monitors, setMonitors] = useState<MonitorView[] | null>(null)
  const [monitorError, setMonitorError] = useState<string | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingPings, setPendingPings] = useState<Record<string, true>>({})
  const [error, setError] = useState<string | null>(null)

  const refreshNetwork = useCallback(async () => {
    const info = await window.api.getNetworkInfo()
    setNetwork(info)
  }, [])

  const refreshSystem = useCallback(async () => {
    const info = await window.api.getSystemInfo()
    setSystem(info)
  }, [])

  const refreshMonitors = useCallback(async () => {
    try {
      setMonitors(uniqueMonitors(await window.api.getMonitors()))
      setMonitorError(null)
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : 'Монитор не прочитан')
    }
  }, [])

  const calibrateMonitors = useCallback(async () => {
    setCalibrating(true)
    setMonitorError(null)
    try {
      setMonitors(uniqueMonitors(await window.api.calibrateMonitors()))
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : 'Не удалось откалибровать')
    } finally {
      setCalibrating(false)
    }
  }, [])

  const refreshAudio = useCallback(async () => {
    try {
      const { inputs, outputs } = await listAudioDevices()
      setAudio({
        inputs: inputs.length,
        outputs: outputs.length,
        inputLabel: inputs.find((device) => device.deviceId !== 'default')?.label || inputs[0]?.label || null,
        outputLabel:
          outputs.find((device) => device.deviceId !== 'default')?.label || outputs[0]?.label || null,
        error: null
      })
    } catch (err) {
      setAudio({
        ...emptyAudio,
        error: err instanceof Error ? err.message : 'Нет доступа к устройствам'
      })
    }
  }, [])

  const runPings = useCallback(async (count = 4, targets: PingTarget[] = PING_TARGETS) => {
    const ids = targets.map((target) => target.id)
    setPendingPings((current) => {
      const next = { ...current }
      for (const id of ids) next[id] = true
      return next
    })
    const unsubscribe = window.api.onPingResult((result) => {
      setPings((current) => ({ ...current, [result.id]: result }))
    })
    try {
      const results = await window.api.pingMany(targets, count)
      setPings((current) => ({
        ...current,
        ...Object.fromEntries(results.map((result) => [result.id, result]))
      }))
    } finally {
      unsubscribe()
      setPendingPings((current) => {
        const next = { ...current }
        for (const id of ids) delete next[id]
        return next
      })
    }
  }, [])

  const runSpeedTest = useCallback(async () => {
    setSpeed({ result: null, live: null, progress: 0, running: true, error: null })
    const off = window.api.onSpeedProgress((event: SpeedProgress) => {
      setSpeed((current) => ({
        ...current,
        progress: event.total ? Math.min(100, Math.round((event.elapsedMs / event.total) * 100)) : 0,
        live: event.mbps > 0 ? { mbps: event.mbps, bytes: event.downloaded } : current.live
      }))
    })
    try {
      const result: SpeedTestResult = await window.api.speedTest()
      if (result.error || result.bytes < 1_000_000) {
        setSpeed({
          result: null,
          live: null,
          progress: 0,
          running: false,
          error: result.error || 'Сервер не отдал тестовый файл'
        })
        return
      }
      setSpeed({
        result: { mbps: result.mbps, bytes: result.bytes, durationMs: result.durationMs },
        live: null,
        progress: 100,
        running: false,
        error: null
      })
    } catch (err) {
      setSpeed({
        result: null,
        live: null,
        progress: 0,
        running: false,
        error: err instanceof Error ? err.message : 'Не удалось замерить скорость'
      })
    } finally {
      off()
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([refreshNetwork(), refreshSystem(), runPings(1, OVERVIEW_TARGETS)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить проверку')
    } finally {
      setLoading(false)
    }
    void refreshAudio()
    void refreshMonitors()
    void runPings(2, BACKGROUND_TARGETS)
  }, [refreshAudio, refreshMonitors, refreshNetwork, refreshSystem, runPings])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => window.api.onMonitorsRefresh(() => void refreshMonitors()), [refreshMonitors])

  useEffect(() => {
    let cancelled = false
    let busy = false

    const tick = async (): Promise<void> => {
      if (busy) return
      busy = true
      try {
        const live = await window.api.getSystemLive()
        if (cancelled) return
        setSystem((current) => (current ? applySystemLive(current, live) : current))
      } catch {
        // keep last snapshot
      } finally {
        busy = false
      }
    }

    const timer = window.setInterval(() => {
      void tick()
    }, 1000)
    void tick()

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const onChange = (): void => {
      void refreshAudio()
    }
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [refreshAudio])

  const pinging = Object.keys(pendingPings).length > 0

  const value = useMemo(
    () => ({
      network,
      system,
      pings,
      audio,
      speed,
      monitors,
      monitorError,
      calibrating,
      loading,
      pinging,
      pendingPings,
      error,
      refreshAll,
      refreshNetwork,
      refreshSystem,
      refreshAudio,
      refreshMonitors,
      calibrateMonitors,
      runPings,
      runSpeedTest
    }),
    [
      audio,
      calibrating,
      calibrateMonitors,
      error,
      loading,
      monitorError,
      monitors,
      network,
      pinging,
      pendingPings,
      pings,
      refreshAll,
      refreshAudio,
      refreshMonitors,
      refreshNetwork,
      refreshSystem,
      runPings,
      runSpeedTest,
      speed,
      system
    ]
  )

  return <DiagnosticsContext.Provider value={value}>{children}</DiagnosticsContext.Provider>
}

function uniqueMonitors(list: MonitorView[]): MonitorView[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    const key = `${item.name}|${item.resolution}|${item.refreshRate}|${item.brightness}|${item.contrast}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useDiagnostics(): DiagnosticsState {
  const context = useContext(DiagnosticsContext)
  if (!context) {
    throw new Error('useDiagnostics must be used within DiagnosticsProvider')
  }
  return context
}
