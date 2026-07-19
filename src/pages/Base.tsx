import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useGameStore, getRankByExp, getNextRank, RANKS } from '../store/useGameStore'
import { GlassCard, NeonButton, ProgressRing, Modal, useToast } from '../components/ui'
import { playButton, playCoin, playLevelUp } from '../engine/audio'
import type { Pet } from '../types'

const PET_AVATARS: Record<Pet['type'], string> = {
  'rocket-cat': '🐱🚀',
  'drone-dog': '🐕🚁',
  'wave-rabbit': '🐰📡',
  'abacus-dragon': '🐉🧮',
}

const PET_SKILLS_DESC: Record<string, string> = {
  '双倍经验': 'Lv3 解锁 · 答题获得双倍经验',
  '免错一次': 'Lv5 解锁 · 每日首次答错不计入',
}

export function Base() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    nickname, exp, coins, diamonds, streakDays, signinClaimedToday, claimSignin,
    pets, activePet, setActivePet, feedPet, maxCombo, todayCombo,
    totalAnswered, totalCorrect, studyDays, masteredCount,
  } = useGameStore()

  const rank = getRankByExp(exp)
  const next = getNextRank(exp)
  const [petModal, setPetModal] = useState<number | null>(null)

  const expInRank = next ? exp - rank.minExp : 0
  const expForNext = next ? next.minExp - rank.minExp : 100
  const expPct = next ? Math.min(100, (expInRank / expForNext) * 100) : 100

  const handleSignin = () => {
    const r = claimSignin()
    if (r.alreadyClaimed) {
      toast('今日已签到', 'info')
    } else {
      playCoin()
      toast(`连签 ${r.days} 天 · +${r.coins}🪙`, 'reward')
    }
  }

  const handleFeed = (i: number) => {
    if (coins < 5) {
      toast('金币不足（需 5🪙）', 'error')
      return
    }
    feedPet(i)
    playCoin()
    toast(`投喂 ${pets[i].name} +20 饱食度`, 'reward')
  }

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
        <h1 className="font-display text-2xl font-black neon-text-cyan">我的基地</h1>
        <p className="text-[11px] text-stardust/50 font-mono mt-1">ASTRO BASE · 宇航员中心</p>
      </motion.div>

      {/* 段位卡片 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong p-5 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-40" style={{ background: rank.color }} />
        <div className="relative flex items-center gap-4">
          <ProgressRing progress={expPct} size={80} stroke={5} color={rank.color}>
            <div className="text-center">
              <div className="text-2xl">{rank.icon}</div>
              <div className="text-[9px] font-mono" style={{ color: rank.color }}>LV.{rank.level}</div>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <div className="font-display text-xl font-black" style={{ color: rank.color }}>{rank.name}</div>
            <div className="text-xs text-stardust/60 mt-0.5">{nickname} · {exp} XP</div>
            {next ? (
              <div className="text-[10px] text-stardust/50 font-mono mt-1">
                距 {next.name} 还需 {next.minExp - exp} XP
              </div>
            ) : (
              <div className="text-[10px] text-neon-gold font-mono mt-1">已达最高段位 👑</div>
            )}
          </div>
        </div>
        {/* 段位进度条 */}
        <div className="relative mt-3 flex gap-1">
          {RANKS.map((r) => (
            <div
              key={r.level}
              className="flex-1 h-1.5 rounded-full"
              style={{
                background: exp >= r.minExp ? r.color : 'rgba(255,255,255,0.1)',
                boxShadow: exp >= r.minExp ? `0 0 6px ${r.color}` : 'none',
              }}
              title={r.name}
            />
          ))}
        </div>
      </motion.div>

      {/* 签到 + 统计 */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4 text-center" glow={!signinClaimedToday}>
          <div className="text-3xl mb-1">🔥</div>
          <div className="font-display font-black text-2xl text-neon-gold">{streakDays}</div>
          <div className="text-[10px] text-stardust/60">连续签到</div>
          <NeonButton
            variant={signinClaimedToday ? 'ghost' : 'primary'}
            onClick={handleSignin}
            disabled={signinClaimedToday}
            className="text-[11px] px-3 py-1.5 mt-2 w-full"
          >
            {signinClaimedToday ? '已签到' : '签到'}
          </NeonButton>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-3xl mb-1">📈</div>
          <div className="font-display font-black text-2xl text-neon-cyan">{accuracy}%</div>
          <div className="text-[10px] text-stardust/60">正确率 · {totalAnswered}题</div>
          <div className="mt-2 text-[11px] text-stardust/60">
            <span className="text-neon-pink">⚡最高{maxCombo}连击</span>
          </div>
        </GlassCard>
      </div>

      {/* 数据快览 */}
      <div className="grid grid-cols-3 gap-2">
        <GlassCard className="p-3 text-center">
          <div className="font-display font-black text-lg text-neon-green">{masteredCount}</div>
          <div className="text-[10px] text-stardust/60">已掌握错题</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <div className="font-display font-black text-lg text-neon-violet">{studyDays.length}</div>
          <div className="text-[10px] text-stardust/60">学习天数</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <div className="font-display font-black text-lg text-neon-gold">💎{diamonds}</div>
          <div className="text-[10px] text-stardust/60">钻石</div>
        </GlassCard>
      </div>

      {/* 宠物园 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-sm neon-text-pink">🐾 宠物园</h3>
          <span className="text-[10px] text-stardust/50 font-mono">当前出战</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet, i) => {
            const isActive = i === activePet
            const hungerPct = pet.hunger
            return (
              <GlassCard key={i} className={`p-3 ${isActive ? 'border-neon-pink/60 shadow-[0_0_20px_rgba(255,46,136,0.2)]' : ''}`}>
                <button onClick={() => { playButton(); setActivePet(i) }} className="w-full text-center">
                  <div className="text-3xl mb-1" style={{ filter: isActive ? 'drop-shadow(0 0 8px #ff2e88)' : 'none' }}>
                    {PET_AVATARS[pet.type]}
                  </div>
                  <div className="text-sm font-tech font-bold" style={{ color: isActive ? '#ff2e88' : '#e0e0ff' }}>
                    {pet.name} {isActive && '⭐'}
                  </div>
                  <div className="text-[10px] text-stardust/50">Lv.{pet.level}</div>
                </button>
                {/* 饱食度 */}
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] text-stardust/50 mb-0.5">
                    <span>饱食</span>
                    <span>{pet.hunger}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${hungerPct}%`,
                        background: hungerPct > 50 ? '#39ff14' : hungerPct > 25 ? '#ffd700' : '#ff3860',
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  <NeonButton variant="ghost" onClick={() => handleFeed(i)} className="text-[10px] px-2 py-1 flex-1">
                    🍖 投喂 5🪙
                  </NeonButton>
                  <NeonButton variant="ghost" onClick={() => { playButton(); setPetModal(i) }} className="text-[10px] px-2 py-1">
                    详情
                  </NeonButton>
                </div>
              </GlassCard>
            )
          })}
        </div>
      </section>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 gap-2">
        <NeonButton variant="secondary" onClick={() => { playButton(); navigate('/data') }} className="text-xs">
          📊 数据中心
        </NeonButton>
        <NeonButton variant="ghost" onClick={() => { playButton(); navigate('/settings') }} className="text-xs">
          ⚙️ 设置
        </NeonButton>
      </div>

      {/* 宠物详情弹窗 */}
      <Modal open={petModal !== null} onClose={() => setPetModal(null)} title="宠物详情">
        {petModal !== null && (
          <div className="text-center">
            <div className="text-6xl mb-2">{PET_AVATARS[pets[petModal].type]}</div>
            <h3 className="font-display text-xl font-bold text-neon-pink">{pets[petModal].name}</h3>
            <p className="text-xs text-stardust/60 mt-1">等级 {pets[petModal].level} · 经验 {pets[petModal].exp}</p>
            <div className="mt-4 text-left">
              <h4 className="text-xs font-tech font-bold text-neon-cyan mb-2">技能</h4>
              {pets[petModal].skills.length === 0 ? (
                <p className="text-xs text-stardust/50">暂无技能，升级解锁（Lv3/Lv5）</p>
              ) : (
                pets[petModal].skills.map((s) => (
                  <div key={s} className="glass p-2 rounded-lg mb-1.5">
                    <div className="text-xs text-neon-gold font-bold">{s}</div>
                    <div className="text-[10px] text-stardust/60">{PET_SKILLS_DESC[s]}</div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 text-left">
              <h4 className="text-xs font-tech font-bold text-neon-cyan mb-2">升级进度</h4>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-pink to-neon-violet rounded-full" style={{ width: `${(pets[petModal].exp / (pets[petModal].level * 100)) * 100}%` }} />
              </div>
              <div className="text-[10px] text-stardust/50 mt-1 font-mono">{pets[petModal].exp} / {pets[petModal].level * 100} XP</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
