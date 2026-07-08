'use client'

import { useEffect, useRef, useState, useMemo } from 'react'

const darkColor = '#1D1A1B'
const lightColor = '#C6D1E1'
const globalFontWeight = 400

const BRUSH_SIZE = 45
const FLIGHT_SPEED = 1.8
const MORPH_SPEED = 0.6
const QUANTIZE_STEPS = 4
const RAIL_THICKNESS = 1.0
const HIGHLIGHT_DURATION = 150 // Approximately 2.5 seconds at 60fps

// ============================================================================
// Curated Collective Pools
// ============================================================================
const DESKTOP_POOL = [
  "≠Tomorrow's| Füture+",
  "[The System]|@Stack",
  "*Let's| get| stårted*",
  "Playing|/Thë/|Part/",
  "$3,0000| Apx.SVG",
  "€Open|&|§hut!?",
  "[data-stream]",
  "reböot| šys_initialize",
  "++cømmunity_~",
  "[stack]|@overflow",
  "€Open|&|§hare!?",
  "// syntax_err|?",
  "{...}|büild/|≠code!",
  "making| it| vísible*",
]

const MOBILE_POOL = [
  "€Open|&|§hare!?",
  "=Else?",
  "[stack]",
  "@Overflow",
  "Lēt's| get| stårteð",
  "(Make)| it| vísible*",
  "$3,0000",
  "Apx.SVG",
  "€Open|&|§hut!?",
  "[data-stream]",
  "//reböot",
  " šys_initialize",
  "++cømmunity_~",
  "// |syntax_err?",
  "{...}büild/",
  "≠code!",
]

const LAYOUTS = {
  desktop: {
    width: 1920,
    height: 1080,
    fontSize: 145,
    lineCount: 7,
    safeMargin: 180,
    spreadHeight: false,
  },
  mobile: {
    width: 1080,
    height: 1350,
    fontSize: 140,
    lineCount: 10,
    safeMargin: 100,
    spreadHeight: true,
  },
}

const easeOutExpo = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x))


type ParticleState = 'idle' | 'dying' | 'spawning' | 'transit'

class Particle {
  id: number
  char: string
  targetChar: string
  color: string
  state: ParticleState
  dead: boolean
  originX: number
  originY: number
  targetX: number
  targetY: number
  baseX: number
  baseY: number
  x: number
  y: number
  progress: number
  baseSpeed: number
  offsetX: number
  offsetY: number
  cooldown: number
  colorTimer: number
  wordIdx: number

  constructor(char: string, x: number, y: number, id: number, state: ParticleState = 'idle') {
    this.id = id
    this.char = char
    this.targetChar = char
    this.color = lightColor
    this.state = state
    this.dead = false

    this.originX = x
    this.originY = y
    this.targetX = x
    this.targetY = y
    this.baseX = x
    this.baseY = y
    this.x = x
    this.y = y

    this.progress = state === 'idle' ? 1 : 0
    this.baseSpeed = 0.015 + Math.random() * 0.01

    this.offsetX = 0
    this.offsetY = 0
    this.cooldown = state === 'idle' ? 0 : 15
    this.colorTimer = 0
    this.wordIdx = 0
  }

  update() {
    if (this.dead) return
    if (this.cooldown > 0) this.cooldown--

    // Automatically fade color back to neutral when the timer runs out
    if (this.colorTimer > 0) {
      this.colorTimer--
      if (this.colorTimer === 0) {
        this.color = lightColor
      }
    }

    if (this.state === 'dying') {
      if (this.progress < 1) {
        this.progress += this.baseSpeed * FLIGHT_SPEED
        this._glitchChar()
        if (this.progress >= 1) this.dead = true
      }
    } else if (this.state === 'spawning') {
      if (this.progress < 1) {
        this.progress += this.baseSpeed * FLIGHT_SPEED
        if (this.progress < 0.9) {
          this._glitchChar()
        } else {
          this.char = this.targetChar
          this.color = lightColor
        }
        if (this.progress >= 1) {
          this.progress = 1
          this.state = 'idle'
        }
      }
    } else if (this.state === 'transit') {
      if (this.progress < 1) {
        this.progress += this.baseSpeed * FLIGHT_SPEED
        if (this.progress < 0.9) {
          this._glitchChar()
        } else {
          this.char = this.targetChar
          this.color = lightColor
        }
        if (this.progress >= 1) {
          this.progress = 1
          this.state = 'idle'
        }
      }

      let pVal = this.progress
      if (pVal < 1) {
        pVal = Math.floor(pVal * QUANTIZE_STEPS) / QUANTIZE_STEPS
      }

      const easedT = easeOutExpo(pVal)
      this.baseX = this.originX + (this.targetX - this.originX) * easedT
    }

    this.offsetX += (0 - this.offsetX) * 0.15
    this.x = this.baseX + this.offsetX
    this.y = this.baseY
  }

  _glitchChar() {
    const threshold = 1.0 - MORPH_SPEED
    if (Math.random() > threshold) {
      const glyphs = 'abcdefghijklmnopqrstuvwxyz0123456789@#$%&*+<>?≠€§'
      this.char = glyphs[Math.floor(Math.random() * glyphs.length)]

      const palette = ['#FF5E00', '#F39FFF', '#86AF25', '#FFCC00', '#9D9CFF']
      this.color = palette[Math.floor(Math.random() * palette.length)]
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return
    ctx.fillStyle = this.color
    if (this.char && this.char !== '') {
      ctx.fillText(this.char, this.x, this.y)
    }
  }
}

// ============================================================================
// SEQUENTIAL STRING SLOT GENERATOR
// ============================================================================
type Slot = { char: string; x: number; wordIdx: number }

const getLineSlots = (
  ctx: CanvasRenderingContext2D,
  metrics: { width: number; tracking: number },
  text: string,
): Slot[] => {
  const { width: canvasWidth, tracking } = metrics

  let currentWidth = 0
  let visibleLength = 0

  // Measure total width, completely ignoring the invisible '|' delimiter
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '|') {
      currentWidth += ctx.measureText(text[i]).width + tracking
      visibleLength++
    }
  }
  if (visibleLength > 0) currentWidth -= tracking // clean terminal alignment

  let currentX = (canvasWidth - currentWidth) / 2
  const slots: Slot[] = []

  let wordIdx = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    // If we hit a pipe, advance the color group index and skip rendering it
    if (char === '|') {
      wordIdx++
      continue
    }

    const charWidth = ctx.measureText(char).width
    const charCenterX = currentX + charWidth / 2

    slots.push({ char, x: charCenterX, wordIdx })
    currentX += charWidth + tracking
  }
  return slots
}

// ============================================================================
// MAIN REACT COMPONENT
// ============================================================================
type Metrics = {
  width: number
  height: number
  fontSize: number
  lineHeight: number
  tracking: number
  yKeys: number[]
}

export default function GenerativeTypography() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  const mouse = useRef({ x: -1000, y: -1000, isDown: false })
  const particles = useRef<Particle[]>([])
  const particleIdRef = useRef(0)
  const lineStateRef = useRef<Record<number, string>>({})
  const lineIndicesRef = useRef<Record<number, number>>({})
  const pendingShufflesRef = useRef<Set<number>>(new Set())
  const hoveredLinesRef = useRef<Set<number>>(new Set())
  const pendingClicksRef = useRef<{ x: number; y: number }[]>([])

  // --- RESPONSIVE STATE ---
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    setIsMobile(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const currentLayout = isMobile ? LAYOUTS.mobile : LAYOUTS.desktop

  const metrics = useMemo<Metrics>(() => {
    const { width, height, fontSize, lineCount, spreadHeight } = currentLayout
    const lineHeight = spreadHeight ? (height * 0.9) / lineCount : fontSize * 1.0
    const tracking = fontSize * -0.05

    const masterStartY = (height - lineCount * lineHeight) / 2 + fontSize / 2
    const yKeys = Array.from({ length: lineCount }, (_, i) => Math.round(masterStartY + i * lineHeight))

    return { width, height, fontSize, lineHeight, tracking, yKeys }
  }, [currentLayout])

  // Main Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = metrics.width * dpr
    canvas.height = metrics.height * dpr
    ctx.scale(dpr, dpr)

    const initCanvas = () => {
      particles.current = []
      lineStateRef.current = {}
      lineIndicesRef.current = {}
      pendingShufflesRef.current.clear()
      hoveredLinesRef.current.clear()
      ctx.font = `${globalFontWeight} ${metrics.fontSize}px "Stack Sans Text"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const pool = isMobile ? MOBILE_POOL : DESKTOP_POOL

      metrics.yKeys.forEach((keyY, index) => {
        const poolIndex = index % pool.length
        lineIndicesRef.current[keyY] = poolIndex

        const lineText = pool[poolIndex]
        lineStateRef.current[keyY] = lineText

        const slots = getLineSlots(ctx, metrics, lineText)
        slots.forEach((slot) => {
          const p = new Particle(slot.char, slot.x, keyY, particleIdRef.current++, 'idle')
          p.wordIdx = slot.wordIdx
          particles.current.push(p)
        })
      })
    }

    const render = () => {
      ctx.fillStyle = darkColor
      ctx.fillRect(0, 0, metrics.width, metrics.height)
      ctx.font = `${globalFontWeight} ${metrics.fontSize}px "Stack Sans Text"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      particles.current.forEach((particle) => {
        particle.update()
      })

      // --- 0. STRICT 1D COLLISION RESOLUTION ---
      metrics.yKeys.forEach((keyY) => {
        const lineP = particles.current
          .filter((p) => !p.dead && Math.round(p.baseY) === keyY)
          .sort((a, b) => a.baseX - b.baseX)

        for (let pass = 0; pass < 3; pass++) {
          for (let i = 0; i < lineP.length - 1; i++) {
            const pA = lineP[i]
            const pB = lineP[i + 1]

            const wA = ctx.measureText(pA.char || ' ').width
            const wB = ctx.measureText(pB.char || ' ').width

            let padding = metrics.tracking
            if (pA.state !== 'idle' || pB.state !== 'idle') {
              padding = 15
            }

            const minGap = wA / 2 + wB / 2 + padding

            if (pB.x - pA.x < minGap) {
              const overlap = minGap - (pB.x - pA.x)
              pA.offsetX -= overlap * 0.5
              pB.offsetX += overlap * 0.5
              pA.x = pA.baseX + pA.offsetX
              pB.x = pB.baseX + pB.offsetX
            }
          }
        }
      })

      // --- 1. TYPOGRAPHIC CALIPER RAILS ---
      const transitParticles = particles.current.filter(
        (p) => p.state === 'transit' || p.state === 'spawning',
      )
      const activeSegments: { pA: Particle; pB: Particle; color: string; dist: number }[] = []
      const seenKeys = new Set<string>()

      const linesOfTransit: Record<number, Particle[]> = {}
      transitParticles.forEach((p) => {
        const y = Math.round(p.baseY)
        if (!linesOfTransit[y]) linesOfTransit[y] = []
        linesOfTransit[y].push(p)
      })

      Object.keys(linesOfTransit).forEach((yStr) => {
        const y = Number(yStr)
        const lineP = linesOfTransit[y]
        for (let i = 0; i < lineP.length; i++) {
          const pA = lineP[i]
          let nearestDist = Infinity
          let nearestNeighbor: Particle | null = null

          for (let j = 0; j < lineP.length; j++) {
            if (i === j) continue
            const pB = lineP[j]
            const dist = Math.abs(pA.x - pB.x)

            if (dist < nearestDist) {
              nearestDist = dist
              nearestNeighbor = pB
            }
          }

          if (nearestNeighbor && nearestDist < 800) {
            const pB = nearestNeighbor
            const key = pA.id < pB.id ? `${pA.id}_${pB.id}` : `${pB.id}_${pA.id}`
            if (!seenKeys.has(key)) {
              seenKeys.add(key)
              activeSegments.push({ pA, pB, color: pA.color, dist: nearestDist })
            }
          }
        }
      })

      const refMetrics = ctx.measureText('x')
      const railAscent = refMetrics.actualBoundingBoxAscent || metrics.fontSize * 0.25
      const railDescent = refMetrics.actualBoundingBoxDescent || metrics.fontSize * 0.25

      activeSegments.forEach((seg) => {
        const { pA, pB, color, dist } = seg
        ctx.strokeStyle = color
        ctx.lineWidth = RAIL_THICKNESS

        const topY = pA.y - railAscent
        const botY = pA.y + railDescent

        ctx.beginPath()
        ctx.moveTo(pA.x, topY)
        ctx.lineTo(pB.x, topY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(pA.x, botY)
        ctx.lineTo(pB.x, botY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(pA.x, topY - 5)
        ctx.lineTo(pA.x, botY + 5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(pB.x, topY - 5)
        ctx.lineTo(pB.x, botY + 5)
        ctx.stroke()

        const midX = (pA.x + pB.x) / 2
        ctx.fillStyle = color
        ctx.font = '500 10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`ΔX:${Math.round(dist)}px`, midX, botY + 8)

        ctx.textBaseline = 'middle'
      })

      // --- 2. ENGINE: FULL-LINE RECONCILIATION ---
      ctx.font = `${globalFontWeight} ${metrics.fontSize}px "Stack Sans Text"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const isBrushing = !isMobile || mouse.current.isDown

      if (isBrushing) {
        const currentHovered = new Set<number>()

        metrics.yKeys.forEach((keyY) => {
          const lineP = particles.current
            .filter((p) => !p.dead && Math.round(p.baseY) === keyY)
            .sort((a, b) => a.x - b.x)

          if (lineP.length > 0) {
            const minX = lineP[0].x
            const maxX = lineP[lineP.length - 1].x

            const isHoveringY = Math.abs(mouse.current.y - keyY) < BRUSH_SIZE
            const isHoveringX =
              mouse.current.x > minX - BRUSH_SIZE && mouse.current.x < maxX + BRUSH_SIZE

            if (isHoveringY && isHoveringX) {
              currentHovered.add(keyY)
            }
          }
        })

        currentHovered.forEach((keyY) => {
          if (!hoveredLinesRef.current.has(keyY)) {
            pendingShufflesRef.current.add(keyY)
          }
        })

        hoveredLinesRef.current = currentHovered
      } else {
        if (hoveredLinesRef.current.size > 0) {
          hoveredLinesRef.current.clear()
        }
      }

      Array.from(pendingShufflesRef.current).forEach((keyY) => {
        const lineParticles = particles.current.filter((p) => !p.dead && Math.round(p.baseY) === keyY)
        const isSettled = lineParticles
          .filter((p) => p.state !== 'dying')
          .every((p) => p.state === 'idle')

        if (isSettled) {
          const pool = isMobile ? MOBILE_POOL : DESKTOP_POOL
          const currentIdx =
            lineIndicesRef.current[keyY] !== undefined ? lineIndicesRef.current[keyY] : 0

          // Fetch currently drawn strings from all other active lines to prevent overlap
          const activeStrings = new Set<string>()
          metrics.yKeys.forEach((y) => {
            if (y !== keyY && lineStateRef.current[y]) {
              activeStrings.add(lineStateRef.current[y])
            }
          })

          // Sequence forward, skipping strings currently rendered elsewhere
          let nextIdx = (currentIdx + 1) % pool.length
          let searchAttempts = 0
          while (activeStrings.has(pool[nextIdx]) && searchAttempts < pool.length) {
            nextIdx = (nextIdx + 1) % pool.length
            searchAttempts++
          }

          lineIndicesRef.current[keyY] = nextIdx
          const newText = pool[nextIdx]
          lineStateRef.current[keyY] = newText

          const newSlots = getLineSlots(ctx, metrics, newText)
          let activeP = lineParticles.filter((p) => p.state !== 'dying')

          if (activeP.length > newSlots.length) {
            const surplus = activeP.length - newSlots.length
            const shuffled = [...activeP].sort(() => Math.random() - 0.5)
            const killList = shuffled.slice(0, surplus)

            killList.forEach((p) => {
              p.state = 'dying'
              p.progress = 0
              p.baseSpeed = 0.015 + Math.random() * 0.01
              p.cooldown = 15
            })
            activeP = shuffled.slice(surplus)
          } else if (newSlots.length > activeP.length) {
            const deficit = newSlots.length - activeP.length
            for (let i = 0; i < deficit; i++) {
              const p = new Particle('', -9999 + i, keyY, particleIdRef.current++, 'spawning')
              particles.current.push(p)
              activeP.push(p)
            }
          }

          activeP.sort((a, b) => a.baseX - b.baseX)
          const sortedSlots = [...newSlots].sort((a, b) => a.x - b.x)

          activeP.forEach((p, idx) => {
            const slot = sortedSlots[idx]
            p.targetX = slot.x
            p.targetY = keyY
            p.targetChar = slot.char
            p.wordIdx = slot.wordIdx

            if (p.state === 'spawning') {
              p.x = p.originX = p.baseX = slot.x
              p.y = p.originY = p.baseY = keyY
              p.progress = 0
              p.baseSpeed = 0.015 + Math.random() * 0.01
              p.cooldown = 15
            } else {
              p.originX = p.x
              p.originY = p.y
              p.state = 'transit'
              p.progress = 0
              p.baseSpeed = 0.015 + Math.random() * 0.01
              p.cooldown = 15
            }
          })

          pendingShufflesRef.current.delete(keyY)
        }
      })

      // --- 3. INJECT COLOR ON CLICKED SETTLED LINES (RANDOM WORD ON TARGET LINE) ---
      while (pendingClicksRef.current.length > 0) {
        const click = pendingClicksRef.current.shift()!

        metrics.yKeys.forEach((keyY) => {
          const lineP = particles.current
            .filter((p) => !p.dead && Math.round(p.baseY) === keyY)
            .sort((a, b) => a.x - b.x)
          if (lineP.length > 0) {
            const minX = lineP[0].x
            const maxX = lineP[lineP.length - 1].x

            // Check if the click landed inside the bounding box of THIS specific line
            const isHoveringY = Math.abs(click.y - keyY) < BRUSH_SIZE
            const isHoveringX = click.x > minX - BRUSH_SIZE && click.x < maxX + BRUSH_SIZE

            if (isHoveringY && isHoveringX) {
              const isSettled = lineP.every((p) => p.state === 'idle')
              if (isSettled) {
                const palette = ['#FF5E00', '#F39FFF', '#86AF25', '#FFCC00', '#9D9CFF']

                // Find all unique word groups on this specific line
                const uniqueWordIndices = [...new Set(lineP.map((p) => p.wordIdx))]

                if (uniqueWordIndices.length > 0) {
                  // Find if there's currently an active colored word on this line
                  const activeP = lineP.find((p) => p.colorTimer > 0)
                  const activeWordIdx = activeP ? activeP.wordIdx : -1

                  // Filter out the active word so we never pick the same one twice in a row
                  let availableIndices = uniqueWordIndices.filter((idx) => idx !== activeWordIdx)

                  // Fallback just in case a line only has one single word group total
                  if (availableIndices.length === 0) {
                    availableIndices = uniqueWordIndices
                  }

                  // Pick a completely random word group from the remaining available ones
                  const targetWordIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)]
                  const highlightColor = palette[Math.floor(Math.random() * palette.length)]

                  // Apply color to the random word, and force the rest of the line to neutral
                  lineP.forEach((p) => {
                    if (p.wordIdx === targetWordIdx) {
                      p.color = highlightColor
                      p.colorTimer = HIGHLIGHT_DURATION
                    } else {
                      p.color = lightColor
                      p.colorTimer = 0
                    }
                  })
                }
              }
            }
          }
        })
      }

      particles.current.forEach((particle) => particle.draw(ctx))
      particles.current = particles.current.filter((p) => !p.dead)

      animationRef.current = requestAnimationFrame(render)
    }

    initCanvas()
    render()

    const fontLinkId = 'stack-sans-text-font'
    if (!document.getElementById(fontLinkId)) {
      const link = document.createElement('link')
      link.id = fontLinkId
      link.href =
        'https://fonts.googleapis.com/css2?family=Stack+Sans+Text:wght@200..700&display=swap'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    document.fonts
      .load(`${globalFontWeight} ${metrics.fontSize}px "Stack Sans Text"`)
      .then(() => {
        initCanvas()
      })
      .catch(() => {})

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [metrics, isMobile])

  // --- INTERACTION RULES (POINTER EVENTS) ---
  const updatePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = metrics.width / rect.width
    const scaleY = metrics.height / rect.height

    mouse.current.x = (e.clientX - rect.left) * scaleX
    mouse.current.y = (e.clientY - rect.top) * scaleY
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    mouse.current.isDown = true
    updatePointer(e)

    if (!isMobile) {
      pendingClicksRef.current.push({ x: mouse.current.x, y: mouse.current.y })
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    updatePointer(e)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    mouse.current.isDown = false
    if (isMobile) {
      mouse.current.x = -1000
      mouse.current.y = -1000
    }
  }

  const handlePointerLeave = () => {
    mouse.current.isDown = false
    mouse.current.x = -1000
    mouse.current.y = -1000
  }

  return (
    <div
      className="flex flex-col min-h-screen font-sans relative overflow-hidden items-center justify-center"
      style={{ backgroundColor: darkColor, color: lightColor }}
    >
      <div
        className="relative w-full transition-all duration-300 flex items-center justify-center cursor-crosshair"
        style={{
          aspectRatio: isMobile ? '4/5' : '16/9',
          backgroundColor: darkColor,
          maxWidth: isMobile ? '80vh' : '1920px',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
        />
      </div>
    </div>
  )
}
