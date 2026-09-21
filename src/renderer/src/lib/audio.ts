export async function listAudioDevices(): Promise<{
  inputs: MediaDeviceInfo[]
  outputs: MediaDeviceInfo[]
}> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    inputs: devices.filter((device) => device.kind === 'audioinput'),
    outputs: devices.filter((device) => device.kind === 'audiooutput')
  }
}

export async function ensureMicLabels(): Promise<void> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const inputs = devices.filter((device) => device.kind === 'audioinput')
  if (inputs.length && inputs.every((device) => !device.label)) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
  }
}

function rmsLevel(data: Uint8Array): number {
  let sum = 0
  for (const value of data) {
    const centered = (value - 128) / 128
    sum += centered * centered
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 3)
}

export async function playTestTone(opts: {
  deviceId?: string
  pan?: number
  frequency?: number
  durationMs?: number
  volume?: number
}): Promise<void> {
  const ctx = new AudioContext()
  try {
    const ctxWithSink = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
    if (opts.deviceId && ctxWithSink.setSinkId) {
      await ctxWithSink.setSinkId(opts.deviceId)
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const pan = ctx.createStereoPanner()
    osc.type = 'sine'
    osc.frequency.value = opts.frequency ?? 520
    gain.gain.value = opts.volume ?? 0.22
    pan.pan.value = opts.pan ?? 0
    osc.connect(pan)
    pan.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    await new Promise((resolve) => setTimeout(resolve, opts.durationMs ?? 900))
    osc.stop()
  } finally {
    await ctx.close()
  }
}

export class MicMonitor {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private data: Uint8Array<ArrayBuffer> | null = null
  private frame = 0

  async start(deviceId: string | undefined, onLevel: (level: number) => void): Promise<void> {
    await this.stop()
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false
    })
    this.context = new AudioContext()
    const source = this.context.createMediaStreamSource(this.stream)
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))

    const tick = (): void => {
      if (!this.analyser || !this.data) return
      this.analyser.getByteTimeDomainData(this.data)
      onLevel(rmsLevel(this.data))
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  async stop(): Promise<void> {
    cancelAnimationFrame(this.frame)
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.analyser = null
    this.data = null
    if (this.context) {
      await this.context.close().catch(() => undefined)
      this.context = null
    }
  }
}

export async function recordClip(stream: MediaStream, durationMs = 3000): Promise<Blob> {
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.start()
  await new Promise((resolve) => setTimeout(resolve, durationMs))
  recorder.stop()
  await new Promise((resolve) => {
    recorder.onstop = resolve
  })
  return new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
}

export async function playBlob(blob: Blob, deviceId?: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.setAttribute('playsinline', 'true')
  const audioWithSink = audio as HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>
  }
  if (deviceId && audioWithSink.setSinkId) {
    await audioWithSink.setSinkId(deviceId)
  }
  await audio.play()
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve()
  })
  URL.revokeObjectURL(url)
}
