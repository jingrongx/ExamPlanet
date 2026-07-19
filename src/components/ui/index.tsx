import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, createContext, useContext, useCallback } from 'react'

// Toast 系统
type Toast = { id: number; text: string; type: 'info' | 'success' | 'error' | 'reward' }
const ToastCtx = createContext<(text: string, type?: Toast['type']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((text: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  const colors = {
    info: 'border-neon-cyan/60 text-neon-cyan',
    success: 'border-neon-green/60 text-neon-green',
    error: 'border-neon-red/60 text-neon-red',
    reward: 'border-neon-gold/80 text-neon-gold',
  }
  const icons = { info: 'ℹ️', success: '✅', error: '❌', reward: '🪙' }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -20, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.8 }}
              className={`glass-strong px-5 py-2.5 flex items-center gap-2 border ${colors[t.type]} font-tech tracking-wide`}
            >
              <span className="text-lg">{icons[t.type]}</span>
              <span className="text-sm">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

// 段位徽章
export function RankBadge({ rank, exp, mini = false }: { rank: { name: string; level: number; color: string; icon: string }; exp: number; mini?: boolean }) {
  if (mini) {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-display font-bold"
        style={{
          border: `1px solid ${rank.color}`,
          color: rank.color,
          boxShadow: `0 0 8px ${rank.color}40`,
        }}
      >
        <span>{rank.icon}</span>
        <span>{rank.name}</span>
      </div>
    )
  }
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-display font-bold"
      style={{
        border: `1px solid ${rank.color}`,
        color: rank.color,
        background: `${rank.color}15`,
        boxShadow: `0 0 12px ${rank.color}50, inset 0 0 12px ${rank.color}20`,
      }}
    >
      <span className="text-xl">{rank.icon}</span>
      <div>
        <div className="text-sm leading-tight">{rank.name}</div>
        <div className="text-[10px] leading-tight opacity-70 font-mono">LV.{rank.level}</div>
      </div>
    </div>
  )
}

// 进度环
export function ProgressRing({
  progress,
  size = 60,
  stroke = 4,
  color = '#00f5ff',
  children,
}: {
  progress: number
  size?: number
  stroke?: number
  color?: string
  children?: React.ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

// 通用按钮
export function NeonButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger:
      'px-6 py-3 rounded-xl font-tech font-semibold tracking-wide bg-gradient-to-br from-neon-red to-pink-700 text-white shadow-[0_4px_20px_rgba(255,56,96,0.4)] hover:shadow-[0_8px_30px_rgba(255,56,96,0.6)] transition-all',
  }[variant]
  return (
    <button className={`${variantClass} ${className}`} {...props}>
      {children}
    </button>
  )
}

// 玻璃卡片
export function GlassCard({
  children,
  className = '',
  glow = false,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  glow?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`glass ${glow ? 'shadow-[0_0_30px_rgba(0,245,255,0.2)]' : ''} ${onClick ? 'cursor-pointer hover:border-white/30 transition-all' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// 模态框
export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}) {
  useEffect(() => {
    if (open) {
      const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
      window.addEventListener('keydown', onEsc)
      return () => window.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,8,24,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            className="glass-strong p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-xl neon-text-cyan">{title}</h3>
                <button
                  onClick={onClose}
                  className="text-stardust/60 hover:text-neon-pink text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
