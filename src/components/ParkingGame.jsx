import { useEffect, useRef, useState } from 'react'

// Simple 2D top-down parking game rendered on canvas
export default function ParkingGame() {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const keysRef = useRef({})
  const [status, setStatus] = useState('park') // 'park' | 'success' | 'crash'
  const [time, setTime] = useState(0)
  const [attempts, setAttempts] = useState(0)

  // World and car state stored in refs so we can mutate in loop
  const worldRef = useRef({ width: 900, height: 560, scale: 1 })
  const carRef = useRef({
    x: 140,
    y: 420,
    w: 54,
    h: 28,
    angle: -Math.PI / 2, // facing up
    v: 0,
    steer: 0,
    color: '#38bdf8',
  })
  const spotRef = useRef({ x: 720, y: 160, w: 70, h: 32, angle: Math.PI, color: '#22c55e' })
  const boundsRef = useRef([
    // Outer walls (x, y, w, h)
    { x: 40, y: 40, w: 820, h: 8 },
    { x: 40, y: 512, w: 820, h: 8 },
    { x: 40, y: 40, w: 8, h: 480 },
    { x: 852, y: 40, w: 8, h: 480 },
    // Obstacles (islands/cars)
    { x: 210, y: 280, w: 180, h: 20 },
    { x: 500, y: 420, w: 220, h: 20 },
    { x: 530, y: 220, w: 20, h: 140 },
  ])

  // Resize handling to scale canvas while keeping physics units stable
  useEffect(() => {
    const handleResize = () => {
      const parent = canvasRef.current?.parentElement
      if (!parent) return
      const maxW = parent.clientWidth - 24
      const maxH = Math.min(parent.clientHeight - 24, 640)
      const scaleW = maxW / worldRef.current.width
      const scaleH = maxH / worldRef.current.height
      worldRef.current.scale = Math.max(0.6, Math.min(scaleW, scaleH))
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = Math.floor(worldRef.current.width * worldRef.current.scale)
        canvas.height = Math.floor(worldRef.current.height * worldRef.current.scale)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Controls
  useEffect(() => {
    const down = (e) => { keysRef.current[e.key] = true }
    const up = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Game loop
  useEffect(() => {
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      update(dt)
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = (hard = false) => {
    setStatus('park')
    setTime(0)
    if (hard) setAttempts((a) => a + 1)
    carRef.current = {
      x: 140,
      y: 420,
      w: 54,
      h: 28,
      angle: -Math.PI / 2,
      v: 0,
      steer: 0,
      color: '#38bdf8',
    }
  }

  const update = (dt) => {
    if (status !== 'park') return
    setTime((t) => t + dt)

    const car = carRef.current
    const keys = keysRef.current

    // Input
    const accel = (keys['ArrowUp'] || keys['w']) ? 120 : 0
    const brake = (keys['ArrowDown'] || keys['s']) ? 120 : 0
    const steerLeft = (keys['ArrowLeft'] || keys['a']) ? 1 : 0
    const steerRight = (keys['ArrowRight'] || keys['d']) ? 1 : 0

    // Longitudinal dynamics
    const maxSpeed = 180 // units per second
    const drag = 30 // natural slowdown
    const thrust = (accel - brake) * dt
    car.v += thrust
    // Clamp speed
    car.v = Math.max(-maxSpeed, Math.min(maxSpeed, car.v))
    // Drag
    if (!accel && !brake) {
      const sign = Math.sign(car.v)
      car.v -= sign * drag * dt
      if (Math.abs(car.v) < 2) car.v = 0
    }

    // Steering only when moving
    const steerStrength = 2.1 // radians per second at unit speed
    const speedFactor = Math.min(1, Math.abs(car.v) / maxSpeed)
    const steerDir = (steerLeft - steerRight)
    car.steer = steerDir * steerStrength * speedFactor
    car.angle += car.steer * dt * (car.v >= 0 ? 1 : -1)

    // Integrate position
    const dx = Math.cos(car.angle) * car.v * dt
    const dy = Math.sin(car.angle) * car.v * dt
    car.x += dx
    car.y += dy

    // Collisions with bounds/obstacles (AABB vs rotated car using simple circle approx)
    const carRadius = Math.hypot(car.w, car.h) / 2 - 2
    const hit = boundsRef.current.find((b) => circleRectIntersect(car.x, car.y, carRadius, b))
    if (hit) {
      // Crash
      setStatus('crash')
      car.v = 0
      return
    }

    // Parking detection: inside spot rect and low speed and aligned angle
    const spot = spotRef.current
    const inSpot = pointInRotatedRect(car.x, car.y, spot)
    const speedOk = Math.abs(car.v) < 10
    const angleDiff = angleDelta(car.angle, spot.angle)
    const angleOk = Math.abs(angleDiff) < 0.25 // ~14 degrees

    if (inSpot && speedOk && angleOk) {
      setStatus('success')
      car.v = 0
    }
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const scale = worldRef.current.scale

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Helper to scale
    ctx.save()
    ctx.scale(scale, scale)

    // Background asphalt
    roundRect(ctx, 0, 0, worldRef.current.width, worldRef.current.height, 12)
    ctx.fillStyle = '#0f172a'
    ctx.fill()

    // Draw parking lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 2
    for (let x = 80; x <= 820; x += 80) {
      dashedLine(ctx, x, 60, x, 500, 10, 12)
    }

    // Parking spot
    const spot = spotRef.current
    ctx.save()
    ctx.translate(spot.x, spot.y)
    ctx.rotate(spot.angle)
    roundRect(ctx, -spot.w / 2, -spot.h / 2, spot.w, spot.h, 6)
    ctx.strokeStyle = status === 'success' ? '#22c55e' : 'rgba(255,255,255,0.6)'
    ctx.setLineDash([8, 6])
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()

    // Obstacles
    boundsRef.current.forEach((b, i) => {
      roundRect(ctx, b.x, b.y, b.w, b.h, 4)
      ctx.fillStyle = i < 4 ? '#111827' : '#334155'
      ctx.fill()
    })

    // Car shadow
    const car = carRef.current
    ctx.save()
    ctx.translate(car.x + 4, car.y + 6)
    ctx.rotate(car.angle)
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
    ctx.restore()

    // Car body
    ctx.save()
    ctx.translate(car.x, car.y)
    ctx.rotate(car.angle)
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6)
    ctx.fillStyle = car.color
    ctx.fill()
    // windows
    ctx.fillStyle = '#e2f3ff'
    roundRect(ctx, -car.w * 0.35, -car.h * 0.28, car.w * 0.7, car.h * 0.56, 4)
    ctx.fill()
    // lights
    ctx.fillStyle = '#fde68a'
    roundRect(ctx, car.w * 0.45 - car.w / 2, -4, 4, 8, 2)
    ctx.fillStyle = '#fca5a5'
    roundRect(ctx, -car.w * 0.45 - 4 + car.w / 2 - car.w, -4, 4, 8, 2)
    ctx.restore()

    // HUD
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const pad = 12
    ctx.fillStyle = 'rgba(15,23,42,0.7)'
    roundRect(ctx, pad, pad, 230, 74, 10)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 14px Inter, ui-sans-serif, system-ui'
    ctx.fillText(`Speed: ${Math.round(car.v)} u/s`, pad + 12, pad + 22)
    ctx.fillText(`Angle: ${(radToDeg(car.angle) % 360).toFixed(0)}°`, pad + 12, pad + 42)
    ctx.fillText(`Time: ${time.toFixed(1)}s`, pad + 12, pad + 62)

    // End banners
    if (status === 'success' || status === 'crash') {
      const msg = status === 'success' ? 'Parked! 🎉' : 'Crashed! 💥'
      const sub = status === 'success' ? `Time: ${time.toFixed(1)}s  |  Attempts: ${attempts}` : 'Try again'
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = 'rgba(2,6,23,0.75)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '700 36px Inter, ui-sans-serif'
      drawCenteredText(ctx, msg, w / 2, h / 2 - 10)
      ctx.font = '500 16px Inter, ui-sans-serif'
      ctx.fillStyle = '#a5b4fc'
      drawCenteredText(ctx, sub, w / 2, h / 2 + 22)
      ctx.font = '600 14px Inter, ui-sans-serif'
      ctx.fillStyle = '#93c5fd'
      drawCenteredText(ctx, 'Press R to restart', w / 2, h / 2 + 48)
    }

    ctx.restore()
  }

  // Utility geometry
  const circleRectIntersect = (cx, cy, r, rect) => {
    const closestX = clamp(cx, rect.x, rect.x + rect.w)
    const closestY = clamp(cy, rect.y, rect.y + rect.h)
    const dx = cx - closestX
    const dy = cy - closestY
    return dx * dx + dy * dy < r * r
  }

  const pointInRotatedRect = (px, py, rect) => {
    const cos = Math.cos(-rect.angle)
    const sin = Math.sin(-rect.angle)
    const rx = cos * (px - rect.x) - sin * (py - rect.y)
    const ry = sin * (px - rect.x) + cos * (py - rect.y)
    return Math.abs(rx) <= rect.w / 2 && Math.abs(ry) <= rect.h / 2
  }

  const angleDelta = (a, b) => {
    let d = ((a - b + Math.PI) % (2 * Math.PI)) - Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    return d
  }

  const radToDeg = (r) => (r * 180) / Math.PI
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  // Drawing helpers
  const roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
  }

  const dashedLine = (ctx, x1, y1, x2, y2, dash = 8, gap = 8) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len
    let dist = 0
    let on = true
    ctx.beginPath()
    while (dist < len) {
      const seg = Math.min(on ? dash : gap, len - dist)
      if (on) {
        ctx.moveTo(x1 + ux * dist, y1 + uy * dist)
        ctx.lineTo(x1 + ux * (dist + seg), y1 + uy * (dist + seg))
      }
      dist += seg
      on = !on
    }
    ctx.stroke()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'r') {
        reset(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On-screen controls for touch
  const TouchControls = () => {
    const press = (k, down) => {
      keysRef.current[k] = down
    }
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 select-none">
        <div className="flex items-center gap-2">
          <button onTouchStart={() => press('ArrowLeft', true)} onTouchEnd={() => press('ArrowLeft', false)} className="w-14 h-14 rounded-full bg-slate-800/70 text-slate-200 active:scale-95">◀</button>
          <button onTouchStart={() => press('ArrowRight', true)} onTouchEnd={() => press('ArrowRight', false)} className="w-14 h-14 rounded-full bg-slate-800/70 text-slate-200 active:scale-95">▶</button>
        </div>
        <div className="flex items-center gap-2">
          <button onTouchStart={() => press('ArrowUp', true)} onTouchEnd={() => press('ArrowUp', false)} className="w-14 h-14 rounded-full bg-slate-800/70 text-slate-200 active:scale-95">▲</button>
          <button onTouchStart={() => press('ArrowDown', true)} onTouchEnd={() => press('ArrowDown', false)} className="w-14 h-14 rounded-full bg-slate-800/70 text-slate-200 active:scale-95">▼</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[100svh] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-60" style={{backgroundImage:'radial-gradient(1000px 300px at 10% 0%, rgba(59,130,246,0.15), transparent 60%), radial-gradient(800px 250px at 90% 0%, rgba(16,185,129,0.12), transparent 60%)'}}></div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Car Parking Challenge</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
            <span className="hidden sm:inline">Controls:</span>
            <span className="font-mono">WASD</span>
            <span>/</span>
            <span className="font-mono">Arrow Keys</span>
            <span className="ml-3">R to restart</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center px-3">
        <canvas ref={canvasRef} className="rounded-xl shadow-2xl border border-white/10 bg-slate-900"/>
      </div>

      <div className="absolute top-4 right-4 z-10">
        {status !== 'park' && (
          <button onClick={() => reset(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow">
            Restart
          </button>
        )}
      </div>

      <TouchControls />
    </div>
  )
}
