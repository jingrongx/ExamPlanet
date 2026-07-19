import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, Suspense, lazy } from 'react'
import { getLicense } from '../data/licenses'
import { GlassCard, NeonButton } from '../components/ui'
import { ErrorBoundary } from '../components/three/ErrorBoundary'
import { playButton, speak, stopSpeak } from '../engine/audio'
import type { LicenseId } from '../types'

// 3D 场景懒加载（按需，避免 Hall 首屏加载全部 3D）
const Cockpit3D = lazy(() => import('../components/three/LicenseScenes').then((m) => ({ default: m.Cockpit3D })))
const DroneCity3D = lazy(() => import('../components/three/LicenseScenes').then((m) => ({ default: m.DroneCity3D })))
const Antenna3D = lazy(() => import('../components/three/LicenseScenes').then((m) => ({ default: m.Antenna3D })))
const Economy3D = lazy(() => import('../components/three/LicenseScenes').then((m) => ({ default: m.Economy3D })))

// 各执照的交互知识点
const LESSONS: Record<LicenseId, { title: string; desc: string; facts: string[]; control: string }> = {
  ppl: {
    title: '飞行驾驶舱 · 空气动力学',
    desc: '拖拽视角观察飞机姿态，调整坡度看升力变化',
    control: '坡度',
    facts: [
      '升力 = ½ρV²S·CL，速度和迎角是关键',
      '坡度 60° 时载荷因子 = 1/cos(60°) = 2g',
      '失速由迎角过大引起，与速度无直接关系',
      '转弯需协调：副翼+方向舵+升降舵配合',
    ],
  },
  uav: {
    title: '无人机城市巡航',
    desc: '观察四旋翼在城市网格上空的飞行轨迹',
    control: '高度',
    facts: [
      '四旋翼通过差速控制 4 个电机实现 6 自由度运动',
      '视距内飞行(VLOS)需保持目视接触，高度≤120m',
      '超视距(BVLOS)需空域申请与地面观察员',
      '电池电压低于 3.3V/cell 应立即返航',
    ],
  },
  ham: {
    title: '无线电天线塔 · 电波传播',
    desc: '调节发射频率，观察电磁波辐射',
    control: '速度',
    facts: [
      '波长 λ = 300 / f(MHz)，单位米',
      '光速 c = 3×10⁸ m/s',
      '业余频段：HF(3-30MHz) 远距离，VHF/UHF 视距',
      '73 = Best Regards，QSO 通用结束用语',
    ],
  },
  eco: {
    title: '经济学 3D 模型 · 供需均衡',
    desc: '观察供给曲线(S)与需求曲线(D)的交点 E',
    control: '模型',
    facts: [
      '均衡点 E：供给量 = 需求量，市场出清',
      'MR=MC 是厂商利润最大化的黄金条件',
      'M0=现金，M1=M0+活期，M2=M1+定期+个人存款',
      '资产 = 负债 + 所有者权益（会计恒等式）',
    ],
  },
}

export function Space3D() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bank, setBank] = useState(0)
  const [altitude, setAltitude] = useState(0.3)
  const [waveSpeed, setWaveSpeed] = useState(1)

  if (!id) return null
  const license = getLicense(id as LicenseId)
  const lesson = LESSONS[license.id]

  const render3D = () => {
    const fallback = <div className="flex items-center justify-center h-full text-neon-cyan animate-pulse">加载 3D 场景...</div>
    const errorFallback = (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <div className="text-6xl animate-float">{license.icon}</div>
        <p className="font-display text-sm neon-text-cyan">{lesson.title}</p>
        <p className="text-[11px] text-stardust/50 max-w-xs">当前环境不支持 3D 渲染，已切换为 2D 模式。下方知识点仍可正常学习。</p>
      </div>
    )
    let scene: React.ReactNode
    switch (license.id) {
      case 'ppl':
        scene = <Suspense fallback={fallback}><Cockpit3D bank={bank} /></Suspense>
        break
      case 'uav':
        scene = <Suspense fallback={fallback}><DroneCity3D altitude={altitude} /></Suspense>
        break
      case 'ham':
        scene = <Suspense fallback={fallback}><Antenna3D speed={waveSpeed} /></Suspense>
        break
      case 'eco':
        scene = <Suspense fallback={fallback}><Economy3D /></Suspense>
        break
    }
    return <ErrorBoundary fallback={errorFallback}>{scene}</ErrorBoundary>
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部 */}
      <div className="fixed top-0 left-0 right-0 z-30 pt-3 px-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={() => { stopSpeak(); playButton(); navigate(`/license/${license.id}`) }}
            className="glass px-3 py-2 rounded-xl text-stardust/70 hover:text-neon-pink"
          >
            ← 返回
          </button>
          <div className="text-center">
            <div className="font-display font-bold text-sm" style={{ color: license.color }}>{license.name} · 3D 模拟</div>
            <div className="text-[10px] text-stardust/50 font-mono">{lesson.title}</div>
          </div>
          <div className="w-16" />
        </div>
      </div>

      {/* 3D 画布 */}
      <div className="flex-1 pt-16 pb-2 relative">
        <div className="absolute inset-0 px-3 pt-16">
          <div className="glass rounded-3xl overflow-hidden h-[50vh] min-h-[360px]">
            {render3D()}
          </div>
        </div>
      </div>

      {/* 控制面板 + 知识点 */}
      <div className="px-3 pb-6 max-w-5xl mx-auto w-full space-y-3 mt-[50vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-4">
            <p className="text-xs text-stardust/70 mb-3">{lesson.desc}</p>
            {/* 交互控件 */}
            {license.id === 'ppl' && (
              <Slider label="飞机坡度 (Bank)" value={bank} min={-0.8} max={0.8} step={0.05} onChange={setBank} display={`${Math.round(bank * 180 / Math.PI)}°`} color={license.color} />
            )}
            {license.id === 'uav' && (
              <Slider label="飞行高度" value={altitude} min={0} max={1.5} step={0.1} onChange={setAltitude} display={`${(1.5 + altitude).toFixed(1)}m`} color={license.color} />
            )}
            {license.id === 'ham' && (
              <Slider label="电波传播速度" value={waveSpeed} min={0.3} max={3} step={0.1} onChange={setWaveSpeed} display={`${waveSpeed.toFixed(1)}x`} color={license.color} />
            )}
          </GlassCard>
        </motion.div>

        {/* 知识点卡片 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="font-display font-bold text-sm neon-text-gold mb-2 px-1">📚 核心知识点</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lesson.facts.map((f, i) => (
              <GlassCard key={i} className="p-3 flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-neon-gold/20 text-neon-gold flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-xs text-stardust/80 leading-relaxed">{f}</p>
                  <button
                    onClick={() => speak(f)}
                    className="mt-1 text-[10px] text-neon-cyan hover:text-neon-pink"
                  >
                    🔊 朗读
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </motion.div>

        <div className="flex gap-2">
          <NeonButton variant="secondary" onClick={() => { stopSpeak(); speak(lesson.facts.join('。')) }} className="flex-1 text-xs">
            🔊 朗读全部
          </NeonButton>
          <NeonButton variant="primary" onClick={() => { stopSpeak(); playButton(); navigate(`/license/${license.id}`) }} className="flex-1 text-xs">
            去答题 →
          </NeonButton>
        </div>
      </div>
    </div>
  )
}

function Slider({
  label, value, min, max, step, onChange, display, color,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs text-stardust/70">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(90deg, ${color} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  )
}
