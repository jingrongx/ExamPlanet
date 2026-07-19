import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useEffect, Suspense } from 'react'
import { LICENSES } from '../data/licenses'
import { useGameStore, getRankByExp } from '../store/useGameStore'
import { GlassCard, NeonButton, useToast } from '../components/ui'
import { playButton, playCoin } from '../engine/audio'
import { SpaceHallScene } from '../components/three/SpaceHallScene'
import { ErrorBoundary } from '../components/three/ErrorBoundary'
import type { LicenseId } from '../types'

// 3D 不可用时的 2D 星球大厅降级
function HallFallback({ onSelect }: { onSelect: (id: LicenseId) => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-center">
        <div className="text-5xl mb-2 animate-float">🪐</div>
        <p className="font-display text-sm neon-text-cyan">星系导航台</p>
        <p className="text-[10px] text-stardust/40 font-mono mt-0.5">2D 模式 · 选择星球进入</p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {LICENSES.map((lic) => (
          <button
            key={lic.id}
            onClick={() => onSelect(lic.id)}
            className="glass p-3 rounded-2xl text-center hover:border-white/30 transition-all"
            style={{ boxShadow: `0 0 0 1px ${lic.color}30` }}
          >
            <div className="text-3xl mb-1" style={{ filter: `drop-shadow(0 0 8px ${lic.color})` }}>{lic.icon}</div>
            <div className="text-xs font-tech font-bold" style={{ color: lic.color }}>{lic.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Hall() {
  const navigate = useNavigate()
  const toast = useToast()
  const { nickname, exp, coins, streakDays, signinClaimedToday, dailyTasks, claimSignin, claimDailyTask, totalAnswered, totalCorrect, mistakes } = useGameStore()
  const rank = getRankByExp(exp)

  const [hallReady, setHallReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHallReady(true), 100)
    return () => clearTimeout(t)
  }, [])

  const goLicense = (id: LicenseId) => {
    playButton()
    navigate(`/license/${id}`)
  }

  const handleSignin = () => {
    const r = claimSignin()
    if (r.alreadyClaimed) {
      toast('今日已签到，明天再来', 'info')
    } else {
      playCoin()
      toast(`签到成功！连签 ${r.days} 天，+${r.coins} 金币`, 'reward')
    }
  }

  const handleTask = (taskId: string) => {
    const r = claimDailyTask(taskId)
    if (r.coins > 0) {
      playCoin()
      toast(`任务奖励 +${r.coins} 金币`, 'reward')
    } else {
      toast('任务未完成', 'info')
    }
  }

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
  const dueMistakes = Object.values(mistakes).filter((m) => !m.mastered && Date.now() >= m.nextReview).length

  return (
    <div className="space-y-4">
      {/* Hero：3D 星球大厅 */}
      <section className="relative h-[58vh] min-h-[420px] rounded-3xl overflow-hidden glass">
        <div className="absolute inset-0">
          {hallReady && (
            <ErrorBoundary fallback={<HallFallback onSelect={goLicense} />}>
              <Suspense fallback={<div className="flex items-center justify-center h-full text-neon-cyan animate-pulse">加载星系中...</div>}>
                <SpaceHallScene onSelect={goLicense} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
        <div className="absolute top-3 left-4 z-10 pointer-events-none">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl sm:text-3xl font-black tracking-wider"
            style={{ background: 'linear-gradient(135deg,#00f5ff,#ff2e88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            考证星球
          </motion.h1>
          <p className="text-stardust/70 text-xs font-tech tracking-widest mt-0.5">CERT · PLANET · UNIVERSE</p>
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
          <p className="text-[10px] text-stardust/50 font-mono animate-pulse">拖拽旋转 · 点击星球进入</p>
        </div>
      </section>

      {/* 欢迎卡片 + 签到 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong p-4 rounded-2xl flex items-center justify-between gap-3"
      >
        <div>
          <div className="font-display text-lg neon-text-cyan">
            {greeting()}，{nickname} {rank.icon}
          </div>
          <div className="text-xs text-stardust/70 mt-0.5">
            当前段位 <span style={{ color: rank.color }} className="font-bold">{rank.name}</span> · 已答 {totalAnswered} 题 · 正确率 {accuracy}%
          </div>
        </div>
        <NeonButton variant={signinClaimedToday ? 'ghost' : 'primary'} onClick={handleSignin} disabled={signinClaimedToday}>
          {signinClaimedToday ? '已签到' : `签到 +${Math.min(100, 10 + streakDays * 15)}🪙`}
        </NeonButton>
      </motion.div>

      {/* 4 执照入口 */}
      <section>
        <SectionTitle title="执照星系" subtitle="选择星球开启征程" />
        <div className="grid grid-cols-2 gap-3">
          {LICENSES.map((lic, i) => (
            <motion.button
              key={lic.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => goLicense(lic.id)}
              className="relative glass p-4 rounded-2xl text-left overflow-hidden group hover:border-white/30 transition-all"
              style={{ boxShadow: `0 0 0 1px ${lic.color}30` }}
            >
              <div
                className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity"
                style={{ background: lic.planetColor }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${lic.color})` }}>{lic.icon}</span>
                  <span className="font-display text-xs px-2 py-0.5 rounded-full" style={{ color: lic.color, border: `1px solid ${lic.color}50` }}>
                    {lic.code}
                  </span>
                </div>
                <div className="font-display font-bold text-sm" style={{ color: lic.color }}>{lic.name}</div>
                <div className="text-[11px] text-stardust/60 mt-0.5 line-clamp-1">{lic.description}</div>
                <div className="text-[10px] text-stardust/40 font-mono mt-1">{lic.questionsCount} 题</div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 到期错题提醒 */}
      {dueMistakes > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => { playButton(); navigate('/mistakes') }}
          className="w-full glass-strong p-3 rounded-2xl flex items-center gap-3 border-neon-red/40"
          style={{ borderLeft: '3px solid #ff3860' }}
        >
          <span className="text-2xl animate-pulse">🔥</span>
          <div className="text-left flex-1">
            <div className="font-tech font-bold text-neon-red text-sm">{dueMistakes} 道错题到期复习</div>
            <div className="text-[11px] text-stardust/60">前往错题熔炉巩固记忆</div>
          </div>
          <span className="text-neon-red">→</span>
        </motion.button>
      )}

      {/* 每日任务 */}
      <section>
        <SectionTitle title="每日任务" subtitle="完成获得金币奖励" />
        <div className="space-y-2">
          {dailyTasks.map((t) => {
            const done = t.progress >= t.target
            const pct = Math.min(100, (t.progress / t.target) * 100)
            return (
              <GlassCard key={t.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-tech">{t.description}</span>
                      {t.claimed && <span className="text-[10px] text-neon-green">已领取</span>}
                    </div>
                    <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: done ? '#39ff14' : '#00f5ff' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-stardust/50 font-mono mt-0.5">
                      {t.progress}/{t.target} · 奖励 {t.reward}🪙
                    </div>
                  </div>
                  <NeonButton
                    variant={done && !t.claimed ? 'primary' : 'ghost'}
                    onClick={() => handleTask(t.id)}
                    disabled={!done || t.claimed}
                    className="text-xs px-3 py-1.5"
                  >
                    {t.claimed ? '已领' : done ? '领取' : '进行中'}
                  </NeonButton>
                </div>
              </GlassCard>
            )
          })}
        </div>
      </section>

      {/* 快捷入口 */}
      <section className="grid grid-cols-3 gap-2">
        <QuickCard icon="📝" label="模拟考试" color="#ff2e88" onClick={() => { playButton(); navigate('/exam/uav') }} />
        <QuickCard icon="🧠" label="记忆工坊" color="#9d4edd" onClick={() => { playButton(); navigate('/memory') }} />
        <QuickCard icon="📊" label="数据中心" color="#00f5ff" onClick={() => { playButton(); navigate('/data') }} />
      </section>
    </div>
  )
}

function QuickCard({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass p-3 rounded-2xl text-center hover:border-white/30 transition-all group">
      <div className="text-2xl mb-1 group-hover:scale-110 transition-transform" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>{icon}</div>
      <div className="text-[11px] font-tech" style={{ color }}>{label}</div>
    </button>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2 flex items-end justify-between">
      <div>
        <h2 className="font-display font-bold text-base neon-text-cyan">{title}</h2>
        <p className="text-[10px] text-stardust/50 font-mono">{subtitle}</p>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '深夜好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}
