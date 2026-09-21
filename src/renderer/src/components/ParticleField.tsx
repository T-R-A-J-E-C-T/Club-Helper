import { useEffect, useRef } from 'react'

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const POINT_COUNT = 2400
const RING_COUNT = 3
const ARC_COUNT = 18
const ARC_STEPS = 28

type Vec = { x: number; y: number; z: number }

function buildPoints(): Vec[] {
  const points: Vec[] = []
  for (let i = 0; i < POINT_COUNT; i += 1) {
    const y = 1 - (i / (POINT_COUNT - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN * i
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius
    })
  }
  return points
}

function buildRings(): Vec[][] {
  return Array.from({ length: RING_COUNT }, (_, ring) => {
    const tilt = (ring - 1) * 0.42
    const steps = 160
    return Array.from({ length: steps }, (__, i) => {
      const a = (i / steps) * Math.PI * 2
      const x = Math.cos(a)
      const z = Math.sin(a)
      const cy = -z * Math.sin(tilt)
      const cz = z * Math.cos(tilt)
      return { x, y: cy, z: cz }
    })
  })
}

function slerp(a: Vec, b: Vec, t: number): Vec {
  const dot = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z))
  const omega = Math.acos(dot)
  if (omega < 0.04) return a
  const sinOmega = Math.sin(omega)
  const s1 = Math.sin((1 - t) * omega) / sinOmega
  const s2 = Math.sin(t * omega) / sinOmega
  return { x: a.x * s1 + b.x * s2, y: a.y * s1 + b.y * s2, z: a.z * s1 + b.z * s2 }
}

function buildArcs(points: Vec[]): Array<[number, number]> {
  const arcs: Array<[number, number]> = []
  let guard = 0
  while (arcs.length < ARC_COUNT && guard < 800) {
    guard += 1
    const i = Math.floor(Math.random() * points.length)
    const j = Math.floor(Math.random() * points.length)
    if (i === j) continue
    const a = points[i]
    const b = points[j]
    const dot = a.x * b.x + a.y * b.y + a.z * b.z
    if (dot > 0.15 || dot < -0.72) continue
    arcs.push([i, j])
  }
  return arcs
}

function project(
  point: Vec,
  cos: number,
  sin: number,
  ct: number,
  st: number,
  cx: number,
  cy: number,
  scale: number
): { x: number; y: number; depth: number; persp: number } {
  const rx = point.x * cos - point.z * sin
  const rz = point.x * sin + point.z * cos
  const ry = point.y * ct - rz * st
  const rz2 = point.y * st + rz * ct
  const persp = 1.35 / (2.15 + rz2)
  return {
    x: cx + rx * scale * persp,
    y: cy + ry * scale * persp,
    depth: (rz2 + 1) / 2,
    persp
  }
}

export function ParticleField({
  active,
  busy,
  label,
  error,
  onToggle,
  onReady
}: {
  active: boolean
  busy: boolean
  label: string
  error: string | null
  onToggle: () => void
  onReady?: () => void
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const busyRef = useRef(busy)
  const onReadyRef = useRef(onReady)
  activeRef.current = active
  busyRef.current = busy
  onReadyRef.current = onReady

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const points = buildPoints()
    const rings = buildRings()
    const arcs = buildArcs(points)
    let frame = 0
    let angle = 0.6
    let energy = 0
    let clock = 0
    let paints = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }

    const draw = (): void => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const target = activeRef.current ? 1 : busyRef.current ? 0.35 : 0
      energy += (target - energy) * 0.05
      clock += 0.016
      angle += 0.0015 + energy * 0.0032

      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const tilt = 0.38
      const ct = Math.cos(tilt)
      const st = Math.sin(tilt)
      const cx = w * 0.58
      const cy = h * 0.54
      const scale = Math.max(w, h) * 0.46
      const core = Math.min(w, h) * 0.1
      const coreSq = core * core

      const glow = ctx.createRadialGradient(cx, cy, scale * 0.06, cx, cy, scale * (1.05 + energy * 0.2))
      glow.addColorStop(0, `rgba(254, 230, 100, ${0.1 + energy * 0.22})`)
      glow.addColorStop(0.42, `rgba(254, 230, 100, ${0.035 + energy * 0.08})`)
      glow.addColorStop(1, 'rgba(254, 230, 100, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      if (energy > 0.04) {
        const pulse = 1 + Math.sin(clock * 2.1) * 0.035 * energy
        ctx.beginPath()
        ctx.strokeStyle = `rgba(254, 230, 100, ${0.1 + energy * 0.28})`
        ctx.lineWidth = dpr * (1.1 + energy)
        ctx.arc(cx, cy, core * 1.22 * pulse, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const ring of rings) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(254, 230, 100, ${0.12 + energy * 0.22})`
        ctx.lineWidth = dpr * (0.8 + energy * 0.6)
        let started = false
        for (const point of ring) {
          const p = project(point, cos, sin, ct, st, cx, cy, scale)
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      if (energy > 0.05) {
        ctx.lineWidth = dpr * (1.1 + energy * 0.8)
        for (let i = 0; i < arcs.length; i += 1) {
          const [ia, ib] = arcs[i]
          ctx.beginPath()
          ctx.strokeStyle = `rgba(254, 230, 100, ${0.08 * energy + 0.16 * energy})`
          for (let step = 0; step <= ARC_STEPS; step += 1) {
            const p = project(slerp(points[ia], points[ib], step / ARC_STEPS), cos, sin, ct, st, cx, cy, scale)
            if (step === 0) ctx.moveTo(p.x, p.y)
            else ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()

          const travel = (clock * 0.22 + i * 0.17) % 1
          const bead = project(slerp(points[ia], points[ib], travel), cos, sin, ct, st, cx, cy, scale)
          ctx.fillStyle = `rgba(254, 230, 100, ${0.35 + energy * 0.55})`
          ctx.beginPath()
          ctx.arc(bead.x, bead.y, (1.6 + energy * 1.4) * dpr * bead.persp, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      for (const point of points) {
        const p = project(point, cos, sin, ct, st, cx, cy, scale)
        const dx = p.x - cx
        const dy = p.y - cy
        if (dx * dx + dy * dy < coreSq) continue
        const radius = (0.55 + p.depth * 1.7 + energy * 0.5) * dpr * p.persp
        ctx.fillStyle = `rgba(254, 230, 100, ${0.08 + p.depth * 0.55 + energy * 0.18})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      paints += 1
      if (paints === 2) onReadyRef.current?.()
      frame = requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <canvas ref={canvasRef} className="particle-field absolute inset-0 h-full w-full" />
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={`pointer-events-auto absolute left-[58%] top-[54%] grid h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-center select-none transition-all duration-500 disabled:cursor-default disabled:opacity-70 ${
          active
            ? 'bg-accent text-accent-ink shadow-[0_0_48px_rgba(254,230,100,0.4)]'
            : 'bg-page/55 text-ink ring-1 ring-accent/35 backdrop-blur-md hover:bg-accent hover:text-accent-ink'
        }`}
      >
        <span className="pointer-events-none px-4 text-[14px] leading-tight font-semibold">{label}</span>
      </button>
      {error ? (
        <p className="pointer-events-none absolute top-[calc(54%+78px)] left-[58%] w-[240px] -translate-x-1/2 text-center text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  )
}
