import React, { useEffect, useRef } from 'react'
import { createNoise3D } from 'simplex-noise'
import { cn } from '../../lib/utils'

type VortexProps = {
  children?: React.ReactNode
  className?: string
  containerClassName?: string
  particleCount?: number
  rangeY?: number
  baseHue?: number
  baseSpeed?: number
  rangeSpeed?: number
  baseRadius?: number
  rangeRadius?: number
  backgroundColor?: string
}

const Vortex = ({
  children,
  className,
  containerClassName,
  particleCount = 260,
  rangeY = 120,
  baseHue = 28,
  baseSpeed = 0.12,
  rangeSpeed = 0.5,
  baseRadius = 0.6,
  rangeRadius = 1.4,
  backgroundColor = 'transparent',
}: VortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationFrameId = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let tick = 0
    const particlePropCount = 9
    const particlePropsLength = particleCount * particlePropCount
    const baseTTL = 50
    const rangeTTL = 150
    const rangeHue = 40
    const noiseSteps = 3
    const xOff = 0.00125
    const yOff = 0.00125
    const zOff = 0.0005
    const noise3D = createNoise3D()
    let particleProps = new Float32Array(particlePropsLength)
    const center = { x: 0, y: 0 }

    const rand = (n: number) => n * Math.random()
    const randRange = (n: number) => n - rand(2 * n)
    const fadeInOut = (t: number, m: number) => {
      const hm = 0.5 * m
      return Math.abs(((t + hm) % m) - hm) / hm
    }
    const lerp = (n1: number, n2: number, speed: number) => (1 - speed) * n1 + speed * n2

    const resize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width))
      canvas.height = Math.max(1, Math.floor(rect.height))
      center.x = rect.width * 0.5
      center.y = rect.height * 0.5
    }

    const initParticle = (i: number) => {
      const x = rand(canvas.width)
      const y = center.y + randRange(rangeY)
      const life = 0
      const ttl = baseTTL + rand(rangeTTL)
      const speed = baseSpeed + rand(rangeSpeed)
      const radius = baseRadius + rand(rangeRadius)
      const hue = baseHue + rand(rangeHue)
      particleProps.set([x, y, 0, 0, life, ttl, speed, radius, hue], i)
    }

    const initParticles = () => {
      tick = 0
      particleProps = new Float32Array(particlePropsLength)
      for (let i = 0; i < particlePropsLength; i += particlePropCount) {
        initParticle(i)
      }
    }

    const checkBounds = (x: number, y: number) =>
      x > canvas.width || x < 0 || y > canvas.height || y < 0

    const drawParticle = (
      x: number,
      y: number,
      x2: number,
      y2: number,
      life: number,
      ttl: number,
      radius: number,
      hue: number,
    ) => {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineWidth = radius
      ctx.strokeStyle = `hsla(${hue}, 90%, 58%, ${fadeInOut(life, ttl)})`
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.closePath()
      ctx.restore()
    }

    const updateParticle = (i: number) => {
      const i2 = 1 + i
      const i3 = 2 + i
      const i4 = 3 + i
      const i5 = 4 + i
      const i6 = 5 + i
      const i7 = 6 + i
      const i8 = 7 + i
      const i9 = 8 + i

      const x = particleProps[i]
      const y = particleProps[i2]
      const n = noise3D(x * xOff, y * yOff, tick * zOff) * noiseSteps * Math.PI * 2
      const vx = lerp(particleProps[i3], Math.cos(n), 0.5)
      const vy = lerp(particleProps[i4], Math.sin(n), 0.5)
      const life = particleProps[i5]
      const ttl = particleProps[i6]
      const speed = particleProps[i7]
      const x2 = x + vx * speed
      const y2 = y + vy * speed
      const radius = particleProps[i8]
      const hue = particleProps[i9]

      drawParticle(x, y, x2, y2, life, ttl, radius, hue)

      particleProps[i] = x2
      particleProps[i2] = y2
      particleProps[i3] = vx
      particleProps[i4] = vy
      particleProps[i5] = life + 1

      if (checkBounds(x, y) || life > ttl) {
        initParticle(i)
      }
    }

    const drawParticles = () => {
      for (let i = 0; i < particlePropsLength; i += particlePropCount) {
        updateParticle(i)
      }
    }

    const renderGlow = () => {
      ctx.save()
      ctx.filter = 'blur(5px) brightness(160%)'
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(canvas, 0, 0)
      ctx.restore()

      ctx.save()
      ctx.filter = 'blur(2px) brightness(140%)'
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(canvas, 0, 0)
      ctx.restore()
    }

    const renderToScreen = () => {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(canvas, 0, 0)
      ctx.restore()
    }

    const draw = () => {
      tick += 1
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      drawParticles()
      renderGlow()
      renderToScreen()
      animationFrameId.current = window.requestAnimationFrame(draw)
    }

    const handleResize = () => {
      resize()
      initParticles()
    }

    resize()
    initParticles()
    draw()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [particleCount, rangeY, baseHue, baseSpeed, rangeSpeed, baseRadius, rangeRadius, backgroundColor])

  return (
    <div ref={containerRef} className={cn('vortex-root', containerClassName)}>
      <div className="vortex-canvas">
        <canvas ref={canvasRef} />
      </div>
      <div className={cn('vortex-content', className)}>{children}</div>
    </div>
  )
}

export default Vortex
