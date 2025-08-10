"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Ripple = {
  x: number
  y: number
  start: number
  duration: number
  maxRadius: number
}

type HexCell = {
  x: number
  y: number
}

type RippleCanvasProps = {
  className?: string
  defaultAutoRipples?: boolean
  autoIntervalMs?: number
  rippleDurationMs?: number
  // Hex grid
  hexSize?: number
  hexGap?: number
  // Appearance (glassy greys, but visible at rest)
  baseFillAlpha?: number
  maxFillAlpha?: number
  baseStrokeAlpha?: number
  maxStrokeAlpha?: number
  baseStrokeWidth?: number
  scaleBoost?: number
  rippleBandWidth?: number
}

export default function RippleCanvas({
  className,
  defaultAutoRipples = false,
  autoIntervalMs = 1600,
  rippleDurationMs = 1700,
  hexSize = 12,
  hexGap = 0.1,
  // More visible at rest, still subtle
  baseFillAlpha = 0.1,
  maxFillAlpha = 0.22,
  baseStrokeAlpha = 0.28,
  maxStrokeAlpha = 0.42,
  baseStrokeWidth = 1.0,
  scaleBoost = 0.06,
  rippleBandWidth = 150,
}: RippleCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const ripplesRef = useRef<Ripple[]>([])
  const hexesRef = useRef<HexCell[]>([])
  const [isAuto, setIsAuto] = useState(defaultAutoRipples)
  const nextAutoAtRef = useRef<number>(performance.now() + autoIntervalMs)
  const [isMounted, setIsMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Hex geometry (flat-top)
  const unitVertsRef = useRef<{ x: number; y: number }[]>([])
  const hexRadiusRef = useRef<number>(hexSize * Math.max(0.4, 1 - hexGap))

  const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)

  // Reduced motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener?.("change", update)
    return () => mq.removeEventListener?.("change", update)
  }, [])

  useEffect(() => {
    if (reducedMotion) setIsAuto(false)
  }, [reducedMotion])

  // Track theme via <html class="dark"> changes so it reflects the toggle immediately
  useEffect(() => {
    const el = document.documentElement
    const update = () => setIsDark(el.classList.contains("dark"))
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const rebuildHexGrid = () => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const R = Math.max(2, hexSize)
    const dx = 1.5 * R
    const dy = Math.sqrt(3) * R

    const cols = Math.ceil(rect.width / dx) + 3
    const rows = Math.ceil(rect.height / dy) + 3
    const x0 = (rect.width - (cols - 1) * dx) / 2
    const y0 = (rect.height - (rows - 1) * dy) / 2

    const hexes: HexCell[] = []
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * dx
      const rowOffset = (c % 2) * (dy / 2)
      for (let r = 0; r < rows; r++) {
        const y = y0 + r * dy + rowOffset
        hexes.push({ x, y })
      }
    }
    hexesRef.current = hexes

    // Precompute unit hex vertices
    const verts = []
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 180) * (60 * k)
      verts.push({ x: Math.cos(ang), y: Math.sin(ang) })
    }
    unitVertsRef.current = verts
    hexRadiusRef.current = R * Math.max(0.4, 1 - hexGap)
  }

  const sizeCanvas = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
    }
    rebuildHexGrid()
  }

  useEffect(() => {
    setIsMounted(true)
    sizeCanvas()
    // Draw one static frame so hexes are visible at rest
    drawFrame()
    const handleResize = () => {
      sizeCanvas()
      drawFrame()
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexSize, hexGap])

  // Also redraw when theme changes so base tiles update immediately
  useEffect(() => {
    if (!isMounted) return
    drawFrame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  const getMaxRadius = (clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return 500
    const { width, height, left, top } = container.getBoundingClientRect()
    const dx = clientX - left
    const dy = clientY - top
    const corners = [
      { cx: 0, cy: 0 },
      { cx: width, cy: 0 },
      { cx: 0, cy: height },
      { cx: width, cy: height },
    ]
    let maxDist = 0
    for (const c of corners) {
      const dist = Math.hypot(c.cx - dx, c.cy - dy)
      if (dist > maxDist) maxDist = dist
    }
    return Math.max(1, maxDist * 0.95)
  }

  const spawnRipple = (clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const duration = reducedMotion ? Math.max(800, rippleDurationMs * 0.6) : rippleDurationMs
    const maxRadius = getMaxRadius(clientX, clientY)
    ripplesRef.current.push({
      x,
      y,
      start: performance.now(),
      duration,
      maxRadius,
    })
    startAnimating()
  }

  const drawFrame = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    if (width === 0 || height === 0) return
    ctx.clearRect(0, 0, width, height)

    const now = performance.now()

    // Auto spawn ripples
    if (isAuto && !reducedMotion && now >= nextAutoAtRef.current) {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const rx = rect.left + Math.random() * rect.width
        const ry = rect.top + Math.random() * rect.height
        spawnRipple(rx, ry)
      }
      const jitter = (Math.random() - 0.5) * (autoIntervalMs * 0.4)
      nextAutoAtRef.current = now + autoIntervalMs + jitter
    }

    // Compute active wavefronts
    const ripples = ripplesRef.current
    const remaining: Ripple[] = []
    const active: { x: number; y: number; R: number }[] = []
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i]
      const tRaw = (now - r.start) / r.duration
      const t = Math.min(1, Math.max(0, tRaw))
      if (t < 1) remaining.push(r)
      const p = easeOutQuad(t)
      active.push({ x: r.x, y: r.y, R: r.maxRadius * p })
    }
    ripplesRef.current = remaining

    // Influence params
    const band = Math.max(10, rippleBandWidth)
    const sigma = band * 0.35
    const twoSigma2 = 2 * sigma * sigma

    const baseFill = Math.min(1, Math.max(0, baseFillAlpha))
    const maxFill = Math.min(1, Math.max(baseFill, maxFillAlpha))
    const baseStrokeA = Math.min(1, Math.max(0, baseStrokeAlpha))
    const maxStrokeA = Math.min(1, Math.max(baseStrokeA, maxStrokeAlpha))
    const strokeBaseW = Math.max(0.2, baseStrokeWidth)

    const Rbase = hexRadiusRef.current
    const verts = unitVertsRef.current
    const hexes = hexesRef.current

    // Neutral grey tones for glassy effect, with good contrast
    const fillL = isDark ? 82 : 40
    const strokeL = isDark ? 78 : 32

    for (let i = 0; i < hexes.length; i++) {
      const h = hexes[i]
      // Max influence over ripples
      let influence = 0
      for (let j = 0; j < active.length; j++) {
        const rp = active[j]
        const dist = Math.hypot(h.x - rp.x, h.y - rp.y)
        const diff = Math.abs(dist - rp.R)
        const infl = Math.exp(-(diff * diff) / twoSigma2)
        if (infl > influence) influence = infl
        if (influence > 0.995) break
      }

      const aFill = baseFill + influence * (maxFill - baseFill)
      const aStroke = baseStrokeA + influence * (maxStrokeA - baseStrokeA)
      const s = 1 + influence * scaleBoost
      const Rdraw = Rbase * s

      ctx.beginPath()
      ctx.moveTo(h.x + verts[0].x * Rdraw, h.y + verts[0].y * Rdraw)
      for (let k = 1; k < 6; k++) {
        ctx.lineTo(h.x + verts[k].x * Rdraw, h.y + verts[k].y * Rdraw)
      }
      ctx.closePath()
      ctx.fillStyle = `hsla(0, 0%, ${fillL}%, ${aFill})`
      ctx.fill()
      ctx.strokeStyle = `hsla(0, 0%, ${strokeL}%, ${aStroke})`
      ctx.lineWidth = strokeBaseW + influence * 0.6
      ctx.stroke()
    }

    // Continue RAF only if needed
    if (ripplesRef.current.length > 0 || isAuto) {
      animationRef.current = requestAnimationFrame(drawFrame)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }

  const startAnimating = () => {
    if (animationRef.current == null) {
      animationRef.current = requestAnimationFrame(drawFrame)
    }
  }

  // Pointer interactions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== "touch") return
      spawnRipple(e.clientX, e.clientY)
    }
    el.addEventListener("pointerdown", onPointerDown)
    return () => el.removeEventListener("pointerdown", onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rippleDurationMs, reducedMotion])

  // Keyboard shortcut: C = clear (then redraw base grid)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") {
        ripplesRef.current = []
        drawFrame()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Draw base frame on mount
  useEffect(() => {
    if (!isMounted) return
    drawFrame()
    if (isAuto && !reducedMotion) startAnimating()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isAuto, reducedMotion])

  // Neutral background
  const gradientClass = useMemo(
    () =>
      "bg-[radial-gradient(1200px_800px_at_20%_10%,hsl(0_0%_100%/.7),transparent_60%),radial-gradient(1000px_700px_at_80%_90%,hsl(0_0%_100%/.6),transparent_60%)] dark:bg-[radial-gradient(1200px_800px_at_20%_10%,hsl(0_0%_10%/.6),transparent_60%),radial-gradient(1000px_700px_at_80%_90%,hsl(0_0%_12%/.6),transparent_60%)]",
    [],
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-dvh w-full overflow-hidden select-none touch-none cursor-pointer",
        "bg-gradient-to-br from-white via-zinc-50 to-stone-100 dark:from-zinc-900 dark:via-neutral-950 dark:to-black",
        gradientClass,
        className,
      )}
      aria-label="Glassy hexagon ripple surface. Click or tap to create ripples."
      role="img"
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  )
}
