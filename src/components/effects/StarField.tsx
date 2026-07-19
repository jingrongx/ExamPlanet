import { useEffect, useRef } from 'react'

// 全屏星空粒子背景
export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)
    let raf = 0

    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.4 + 0.3,
      tw: Math.random() * Math.PI * 2,
      color: Math.random() > 0.85 ? '#ff2e88' : Math.random() > 0.6 ? '#00f5ff' : '#ffffff',
    }))

    const shootingStars: { x: number; y: number; vx: number; vy: number; life: number }[] = []

    function spawnShooting() {
      if (Math.random() < 0.012 && shootingStars.length < 3) {
        shootingStars.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.4,
          vx: -6 - Math.random() * 4,
          vy: 2 + Math.random() * 2,
          life: 1,
        })
      }
    }

    function frame() {
      ctx.fillStyle = 'rgba(5,8,24,0.25)'
      ctx.fillRect(0, 0, w, h)
      for (const s of stars) {
        s.tw += 0.02
        const alpha = 0.4 + Math.sin(s.tw) * 0.3
        ctx.fillStyle = s.color
        ctx.globalAlpha = alpha * s.z
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2)
        ctx.fill()
        // 微动
        s.x -= 0.05 * s.z
        if (s.x < 0) s.x = w
      }
      ctx.globalAlpha = 1

      spawnShooting()
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i]
        const trail = 30
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * trail, ss.y - ss.vy * trail)
        grad.addColorStop(0, `rgba(0,245,255,${ss.life})`)
        grad.addColorStop(1, 'rgba(0,245,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(ss.x - ss.vx * trail, ss.y - ss.vy * trail)
        ctx.stroke()
        ss.x += ss.vx
        ss.y += ss.vy
        ss.life -= 0.012
        if (ss.life <= 0) shootingStars.splice(i, 1)
      }

      raf = requestAnimationFrame(frame)
    }
    frame()

    function onResize() {
      w = canvas!.width = window.innerWidth
      h = canvas!.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  )
}
