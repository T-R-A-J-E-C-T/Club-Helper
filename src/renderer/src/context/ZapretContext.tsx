import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { ZapretState } from '@shared/types'

interface ZapretContextValue {
  state: ZapretState | null
  busy: boolean
  downloadPercent: number | null
  error: string | null
  selected: string
  setSelected: (file: string) => void
  refresh: () => Promise<void>
  download: () => Promise<void>
  start: (file?: string) => Promise<void>
  stop: () => Promise<void>
  uninstall: () => Promise<void>
  toggle: () => Promise<void>
  quickLaunch: () => Promise<void>
  toggleGameFilter: (enabled: boolean) => Promise<void>
  booted: boolean
}

const ZapretContext = createContext<ZapretContextValue | null>(null)
const QUICK_STRATEGY_FILE = 'general (ALT11).bat'

function resolveQuickFile(strategies: { file: string }[]): string {
  return strategies.find((item) => /alt\s*11/i.test(item.file))?.file || QUICK_STRATEGY_FILE
}

export function ZapretProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<ZapretState | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [booted, setBooted] = useState(false)
  const selectedRef = useRef(selected)
  const pickDirty = useRef(false)
  selectedRef.current = selected

  const pick = useCallback((file: string) => {
    pickDirty.current = true
    setSelected(file)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.getZapretState()
      setState(next)
      setSelected((current) => {
        const live =
          (next.running ? matchStrategyFile(next.strategies, next.activeStrategy) : null) ||
          matchStrategyFile(next.strategies, next.strategy) ||
          next.strategies[0]?.file ||
          current
        if (pickDirty.current && next.strategies.some((item) => item.file === current)) return current
        return live
      })
    } finally {
      setBooted(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const run = useCallback(
    async (action: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>) => {
      setBusy(true)
      setError(null)
      try {
        const result = await action()
        await refresh()
        if (!result.ok && !result.cancelled) setError(friendlyZapretError(result.error))
        if (result.cancelled) setError('Нужно разрешить права администратора')
      } catch (err) {
        setError(friendlyZapretError(err instanceof Error ? err.message : undefined))
      } finally {
        setBusy(false)
        setDownloadPercent(null)
      }
    },
    [refresh]
  )

  const download = useCallback(async () => {
    setBusy(true)
    setError(null)
    setDownloadPercent(0)
    const off = window.api.onZapretDownloadProgress((progress) => {
      setDownloadPercent(progress.total ? Math.round((progress.received / progress.total) * 100) : 0)
    })
    try {
      const result = await window.api.downloadZapret()
      await refresh()
      if (!result.ok) setError(result.error || 'Не удалось скачать zapret')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать zapret')
    } finally {
      off()
      setBusy(false)
    }
  }, [refresh])

  const start = useCallback(async (file?: string) => {
    const chosen = file || selectedRef.current
    pickDirty.current = false
    if (chosen) setSelected(chosen)
    await run(() => window.api.startZapret(chosen))
  }, [run])

  const stop = useCallback(async () => {
    await run(() => window.api.stopZapret())
  }, [run])

  const uninstall = useCallback(async () => {
    pickDirty.current = false
    await run(() => window.api.uninstallZapret())
    setSelected('')
  }, [run])

  const toggle = useCallback(async () => {
    const current = await window.api.getZapretState()
    if (current.running) {
      await stop()
      return
    }
    let next = current
    if (!current.ready) {
      await download()
      next = await window.api.getZapretState()
      if (!next.ready) return
    }
    const file =
      selectedRef.current ||
      next.strategies.find((item) => item.recommended)?.file ||
      next.strategies[0]?.file ||
      ''
    if (!file) return
    if (next.gameFilter) {
      await window.api.setZapretGameFilter(false)
    }
    await start(file)
  }, [download, start, stop])

  const quickLaunch = useCallback(async () => {
    const current = await window.api.getZapretState()
    if (current.running) {
      await stop()
      return
    }
    let next = current
    if (!current.ready) {
      await download()
      next = await window.api.getZapretState()
      if (!next.ready) return
    }
    await start(resolveQuickFile(next.strategies))
  }, [download, start, stop])

  const toggleGameFilter = useCallback(
    async (enabled: boolean) => {
      await run(() => window.api.setZapretGameFilter(enabled))
    },
    [run]
  )

  const value = useMemo(
    () => ({
      state,
      busy,
      downloadPercent,
      error,
      selected,
      setSelected: pick,
      refresh,
      download,
      start,
      stop,
      uninstall,
      toggle,
      quickLaunch,
      toggleGameFilter,
      booted
    }),
    [
      booted,
      busy,
      download,
      downloadPercent,
      error,
      quickLaunch,
      refresh,
      pick,
      selected,
      start,
      state,
      stop,
      uninstall,
      toggle,
      toggleGameFilter
    ]
  )

  return <ZapretContext.Provider value={value}>{children}</ZapretContext.Provider>
}

export function useZapret(): ZapretContextValue {
  const context = useContext(ZapretContext)
  if (!context) throw new Error('useZapret must be used within ZapretProvider')
  return context
}

function matchStrategyFile(
  strategies: { file: string }[],
  wanted: string | null | undefined
): string | null {
  if (!wanted) return null
  const exact = strategies.find((item) => item.file === wanted)
  if (exact) return exact.file
  const withExt = wanted.toLowerCase().endsWith('.bat') ? wanted : `${wanted}.bat`
  const byName = strategies.find((item) => item.file.toLowerCase() === withExt.toLowerCase())
  if (byName) return byName.file
  const compact = wanted.replace(/[()]/g, '').replace(/\.bat$/i, '').toLowerCase()
  return (
    strategies.find(
      (item) => item.file.replace(/[()]/g, '').replace(/\.bat$/i, '').toLowerCase() === compact
    )?.file ?? null
  )
}

function friendlyZapretError(error?: string): string {
  if (!error) return 'Не удалось выполнить действие'
  if (/eperm|eacces|operation not permitted|unlink|rmdir/i.test(error)) {
    return 'Не удалось удалить файлы обхода. Попробуйте ещё раз.'
  }
  return error
}
