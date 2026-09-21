import { useEffect, useRef, useState } from 'react'
import { Card, Kicker } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { Select } from '@renderer/components/Select'
import { BarSlider } from '@renderer/components/BarSlider'
import { useDiagnostics } from '@renderer/context/DiagnosticsContext'
import {
  ensureMicLabels,
  listAudioDevices,
  MicMonitor,
  playBlob,
  playTestTone,
  recordClip
} from '@renderer/lib/audio'

export function AudioScreen(): React.JSX.Element {
  const { refreshAudio } = useDiagnostics()
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [inputId, setInputId] = useState<string>('')
  const [outputId, setOutputId] = useState<string>('')
  const [level, setLevel] = useState(0)
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState(0.22)
  const monitor = useRef(new MicMonitor())

  async function loadDevices(): Promise<void> {
    try {
      await ensureMicLabels()
    } catch {
      setError('Нет доступа к микрофону')
    }
    const devices = await listAudioDevices()
    setInputs(devices.inputs)
    setOutputs(devices.outputs)
    setInputId((current) => current || devices.inputs[0]?.deviceId || '')
    setOutputId((current) => current || devices.outputs[0]?.deviceId || '')
    await refreshAudio()
  }

  useEffect(() => {
    void loadDevices()
    return () => {
      void monitor.current.stop()
    }
  }, [])

  async function toggleListen(): Promise<void> {
    if (listening) {
      await monitor.current.stop()
      setListening(false)
      setLevel(0)
      return
    }
    try {
      await monitor.current.start(inputId || undefined, setLevel)
      setListening(true)
      setError(null)
    } catch {
      setError('Не удалось открыть микрофон')
    }
  }

  async function recordAndPlay(): Promise<void> {
    try {
      if (!listening) {
        await monitor.current.start(inputId || undefined, setLevel)
        setListening(true)
      }
      const stream = monitor.current.getStream()
      if (!stream) throw new Error('no stream')
      setRecording(true)
      setError(null)
      const blob = await recordClip(stream, 3000)
      setRecording(false)
      await playBlob(blob, outputId || undefined)
    } catch {
      setRecording(false)
      setError('Запись не удалась')
    }
  }

  async function tone(pan: number): Promise<void> {
    await playTestTone({
      deviceId: outputId || undefined,
      pan,
      volume,
      durationMs: 850
    })
  }

  const outputLabel = outputs.find((device) => device.deviceId === outputId)?.label || 'Выберите выход'
  const inputLabel = inputs.find((device) => device.deviceId === inputId)?.label || 'Выберите вход'

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader kicker="Звук" title="Микрофон и наушники" />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <Card className="flex min-h-0 flex-col">
          <Kicker>Наушники</Kicker>
          <p className="mt-3 truncate text-[28px] leading-[1.05] font-semibold tracking-tight">
            {outputLabel}
          </p>
          <label className="mt-8 text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
            Устройство
          </label>
          <Select
            value={outputId}
            onChange={setOutputId}
            placeholder="Наушники"
            options={outputs.map((device) => ({
              value: device.deviceId,
              label: device.label || 'Динамики'
            }))}
          />
          <label className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
            Громкость {Math.round(volume * 100)}%
          </label>
          <BarSlider min={0.05} max={0.5} step={0.01} value={volume} onChange={setVolume} />
          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            <button
              type="button"
              onClick={() => void tone(0)}
              className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink"
            >
              Тест
            </button>
            <button
              type="button"
              onClick={() => void tone(-1)}
              className="rounded-full bg-white/6 px-4 py-2.5 text-[13px] font-medium ring-1 ring-white/8"
            >
              Левый
            </button>
            <button
              type="button"
              onClick={() => void tone(1)}
              className="rounded-full bg-white/6 px-4 py-2.5 text-[13px] font-medium ring-1 ring-white/8"
            >
              Правый
            </button>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Kicker>Микрофон</Kicker>
              <p className="mt-3 truncate text-[28px] leading-[1.05] font-semibold tracking-tight">
                {inputLabel}
              </p>
            </div>
            {listening ? (
              <span className="mt-1 flex items-center gap-2 rounded-full bg-page/55 px-3 py-1.5 text-[12px] backdrop-blur-md ring-1 ring-white/8">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                слушает
              </span>
            ) : null}
          </div>
          <label className="mt-8 text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
            Устройство
          </label>
          <Select
            value={inputId}
            onChange={setInputId}
            placeholder="Микрофон"
            options={inputs.map((device) => ({
              value: device.deviceId,
              label: device.label || 'Микрофон'
            }))}
          />
          <p className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">Уровень</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-page-deep">
            <div
              className="meter-fill h-full rounded-full bg-accent"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
          {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            <button
              type="button"
              onClick={() => void toggleListen()}
              className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink"
            >
              {listening ? 'Стоп' : 'Слушать'}
            </button>
            <button
              type="button"
              disabled={recording}
              onClick={() => void recordAndPlay()}
              className="rounded-full bg-white/6 px-4 py-2.5 text-[13px] font-medium ring-1 ring-white/8 disabled:opacity-60"
            >
              {recording ? 'Запись…' : 'Запись 3 сек'}
            </button>
            <button
              type="button"
              onClick={() => void loadDevices()}
              className="rounded-full bg-white/6 px-4 py-2.5 text-[13px] font-medium ring-1 ring-white/8"
            >
              Обновить
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
