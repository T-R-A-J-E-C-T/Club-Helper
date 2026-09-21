import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { TabId } from '@shared/types'
import { BootScreen } from '@renderer/components/BootScreen'
import { TitleBar } from '@renderer/components/TitleBar'
import { ParticleField } from '@renderer/components/ParticleField'
import { DiagnosticsProvider, useDiagnostics } from '@renderer/context/DiagnosticsContext'
import { ZapretProvider, useZapret } from '@renderer/context/ZapretContext'
import { Overview } from '@renderer/screens/Overview'
import { NetworkScreen } from '@renderer/screens/Network'
import { PingScreen } from '@renderer/screens/Ping'
import { AudioScreen } from '@renderer/screens/Audio'
import { SystemScreen } from '@renderer/screens/System'
import { DisplayScreen } from '@renderer/screens/Display'
import { ZapretScreen } from '@renderer/screens/Zapret'

const BOOT_MIN_MS = 520
const BOOT_MAX_MS = 8000

function Pane({ show, children }: { show: boolean; children: ReactNode }): React.JSX.Element {
  return (
    <div className={show ? 'h-full min-h-0' : 'hidden'} aria-hidden={!show}>
      {children}
    </div>
  )
}

function Shell(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('overview')
  const [bootOpen, setBootOpen] = useState(true)
  const [bootMounted, setBootMounted] = useState(true)
  const [globeReady, setGlobeReady] = useState(false)
  const started = useRef(performance.now())
  const zapret = useZapret()
  const { loading } = useDiagnostics()
  const home = tab === 'overview'
  const running = Boolean(zapret.state?.running)
  const ready = Boolean(zapret.state?.ready)
  const dataReady = !loading && zapret.booted && globeReady
  const globeLabel = zapret.busy
    ? zapret.downloadPercent != null
      ? `${zapret.downloadPercent}%`
      : 'Подождите'
    : running
      ? 'РАБОТАЕТ'
      : ready
        ? 'ЗАПУСТИТЬ'
        : 'Установить'

  useEffect(() => {
    if (!dataReady) return
    const wait = Math.max(0, BOOT_MIN_MS - (performance.now() - started.current))
    const timer = window.setTimeout(() => setBootOpen(false), wait)
    return () => window.clearTimeout(timer)
  }, [dataReady])

  useEffect(() => {
    const timer = window.setTimeout(() => setBootOpen(false), BOOT_MAX_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const dropBoot = useCallback(() => {
    setBootMounted(false)
  }, [])

  return (
    <div className="relative flex h-full flex-col bg-page text-ink">
      {home ? (
        <>
          <div className="particle-vignette pointer-events-none absolute inset-0" />
          <ParticleField
            active={running}
            busy={zapret.busy}
            label={globeLabel}
            error={bootOpen ? null : zapret.error}
            onToggle={() => void zapret.quickLaunch()}
            onReady={() => setGlobeReady(true)}
          />
        </>
      ) : (
        <div className="page-glow pointer-events-none absolute inset-0" />
      )}
      <div className="drag-region relative z-20 shrink-0 px-7 pt-5">
        <TitleBar tab={tab} onTab={setTab} />
      </div>
      <main
        className={`relative z-20 min-h-0 flex-1 overflow-hidden px-7 pb-7 pt-2 ${
          home ? 'pointer-events-none' : ''
        }`}
      >
        <Pane show={tab === 'overview'}>
          <Overview onOpen={setTab} />
        </Pane>
        <Pane show={tab === 'network'}>
          <NetworkScreen />
        </Pane>
        <Pane show={tab === 'ping'}>
          <PingScreen active={tab === 'ping'} />
        </Pane>
        <Pane show={tab === 'system'}>
          <SystemScreen />
        </Pane>
        <Pane show={tab === 'display'}>
          <DisplayScreen />
        </Pane>
        <Pane show={tab === 'zapret'}>
          <ZapretScreen />
        </Pane>
        {tab === 'audio' ? <AudioScreen /> : null}
      </main>
      {bootMounted ? <BootScreen open={bootOpen} onGone={dropBoot} /> : null}
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <DiagnosticsProvider>
      <ZapretProvider>
        <Shell />
      </ZapretProvider>
    </DiagnosticsProvider>
  )
}
