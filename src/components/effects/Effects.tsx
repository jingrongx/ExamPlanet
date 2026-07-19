import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

// 飞行金币特效
export function CoinBurst({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<{ id: number; coins: { dx: number; dy: number; rot: number }[] }[]>([])

  useEffect(() => {
    if (trigger === 0) return
    const coins = Array.from({ length: 12 }, () => ({
      dx: (Math.random() - 0.5) * 400,
      dy: -(150 + Math.random() * 250),
      rot: (Math.random() - 0.5) * 720,
    }))
    const id = Date.now()
    setBursts((b) => [...b, { id, coins }])
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1500)
  }, [trigger])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {bursts.map((burst) => (
          <div key={burst.id} className="absolute left-1/2 top-1/2">
            {burst.coins.map((c, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{ x: c.dx, y: c.dy, opacity: 0, scale: 0.4, rotate: c.rot }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="absolute text-3xl"
                style={{ filter: 'drop-shadow(0 0 8px #ffd700)' }}
              >
                🪙
              </motion.div>
            ))}
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Combo 提示
export function ComboFlash({ combo }: { combo: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (combo > 0 && combo % 5 === 0) {
      setShow(true)
      const t = setTimeout(() => setShow(false), 1200)
      return () => clearTimeout(t)
    }
  }, [combo])
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 0 }}
          animate={{ scale: 1.2, opacity: 1, y: -30 }}
          exit={{ scale: 1.6, opacity: 0, y: -60 }}
          className="fixed left-1/2 top-1/3 -translate-x-1/2 pointer-events-none z-50"
        >
          <div
            className="font-display font-black text-7xl"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #ff2e88)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.8))',
            }}
          >
            {combo} COMBO!
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 暴击全屏闪光
export function CritFlash({ trigger }: { trigger: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (trigger === 0) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 600)
    return () => clearTimeout(t)
  }, [trigger])
  if (!show) return null
  return (
    <motion.div
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        background:
          'radial-gradient(circle at center, rgba(255,215,0,0.4), rgba(255,46,136,0.2) 40%, transparent 70%)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 1, rotate: -15 }}
          animate={{ scale: 1.8, opacity: 0, rotate: 15 }}
          transition={{ duration: 0.6 }}
          className="font-display font-black text-9xl"
          style={{
            color: '#ffd700',
            textShadow: '0 0 30px #ff2e88, 0 0 60px #ffd700',
          }}
        >
          暴击!
        </motion.div>
      </div>
    </motion.div>
  )
}

// 错误抖动
export function WrongShake({ trigger, children }: { trigger: number; children: React.ReactNode }) {
  const [shake, setShake] = useState(false)
  useEffect(() => {
    if (trigger === 0) return
    setShake(true)
    const t = setTimeout(() => setShake(false), 500)
    return () => clearTimeout(t)
  }, [trigger])
  return (
    <motion.div
      animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  )
}

// 正确反馈光晕
export function CorrectGlow({ trigger }: { trigger: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (trigger === 0) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 800)
    return () => clearTimeout(t)
  }, [trigger])
  if (!show) return null
  return (
    <motion.div
      initial={{ opacity: 0.6, scale: 0.8 }}
      animate={{ opacity: 0, scale: 1.3 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 pointer-events-none z-40"
      style={{
        background:
          'radial-gradient(circle at center, rgba(57,255,20,0.3), transparent 60%)',
      }}
    />
  )
}

// 升级横幅
export function RankUpBanner({ trigger, rankName }: { trigger: number; rankName: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (trigger === 0) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(t)
  }, [trigger])
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="glass-strong px-10 py-6 text-center">
            <div className="text-6xl mb-2">🎉</div>
            <div className="font-display text-3xl neon-text-gold mb-1">RANK UP!</div>
            <div className="font-display text-2xl neon-text-cyan">晋升至 {rankName}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
