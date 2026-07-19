import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { isDueForReview, getDaysUntilReview, getMasteryProgress } from '../engine/srs'
import { getQuestion } from '../data/licenses'
import { LICENSES } from '../data/licenses'
import { GlassCard, NeonButton, ProgressRing, useToast } from '../components/ui'
import {
  playCorrect, playWrong, playCoin, playStageClear, playButton, speak, stopSpeak,
} from '../engine/audio'
import { CoinBurst, CorrectGlow, WrongShake } from '../components/effects/Effects'
import type { MistakeCard } from '../types'

export function Mistakes() {
  const { mistakes, answer, settings, masteredCount } = useGameStore()
  const navigate = useNavigate()
  const toast = useToast()

  const allCards = useMemo(() => Object.values(mistakes).filter((m) => !m.mastered), [mistakes])
  const dueCards = useMemo(() => allCards.filter(isDueForReview), [allCards])
  const lv3Cards = useMemo(() => allCards.filter((m) => m.level === 3), [allCards])

  const [reviewing, setReviewing] = useState(false)
  const [queue, setQueue] = useState<MistakeCard[]>([])
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)
  const [coinBurst, setCoinBurst] = useState(0)
  const [correctGlow, setCorrectGlow] = useState(0)
  const [wrongShake, setWrongShake] = useState(0)

  const startReview = useCallback((cards: MistakeCard[]) => {
    if (cards.length === 0) {
      toast('暂无到期错题', 'info')
      return
    }
    playButton()
    setQueue(cards)
    setIdx(0)
    setCorrectCount(0)
    setSelected(null)
    setLocked(false)
    setDone(false)
    setReviewing(true)
  }, [toast])

  const current = queue[idx]
  const currentQ = current ? getQuestion(current.questionId) : null

  const handleSelect = useCallback((opt: string) => {
    if (locked || !currentQ || !current) return
    setSelected(opt)
    setLocked(true)
    const correctOpt = currentQ.options[currentQ.answer.charCodeAt(0) - 65] || currentQ.answer
    const isCorrect = opt === correctOpt || opt === currentQ.answer
    const quality = isCorrect ? 5 : 1
    answer(current.questionId, isCorrect, quality, 5000)
    if (isCorrect) {
      setCorrectCount((c) => c + 1)
      setCorrectGlow((x) => x + 1)
      playCorrect()
      setTimeout(() => { playCoin(); setCoinBurst((x) => x + 1) }, 150)
      if (getMasteryProgress({ ...current, consecutiveCorrect: current.consecutiveCorrect + 1 }) >= 100) {
        toast('🎓 此题已掌握！', 'reward')
      }
    } else {
      setWrongShake((x) => x + 1)
      playWrong()
    }
    if (settings.ttsEnabled) setTimeout(() => speak(currentQ.explanation), 500)
  }, [locked, currentQ, current, answer, settings.ttsEnabled, toast])

  const next = useCallback(() => {
    stopSpeak()
    playButton()
    if (idx + 1 >= queue.length) {
      setReviewing(false)
      setDone(true)
      playStageClear()
    } else {
      setIdx((i) => i + 1)
      setSelected(null)
      setLocked(false)
    }
  }, [idx, queue.length])

  // 按执照分组统计
  const byLicense = useMemo(() => {
    const map: Record<string, MistakeCard[]> = { ppl: [], uav: [], ham: [], eco: [] }
    for (const c of allCards) {
      const lic = c.questionId.split('-')[0].toLowerCase()
      if (map[lic]) map[lic].push(c)
    }
    return map
  }, [allCards])

  if (reviewing && currentQ) {
    return (
      <ReviewSession
        q={currentQ}
        card={current}
        idx={idx}
        total={queue.length}
        selected={selected}
        locked={locked}
        onSelect={handleSelect}
        onNext={next}
        correctGlow={correctGlow}
        wrongShake={wrongShake}
        coinBurst={coinBurst}
        onExit={() => { stopSpeak(); setReviewing(false) }}
        ttsEnabled={settings.ttsEnabled}
      />
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-strong p-8 rounded-3xl max-w-md w-full text-center"
        >
          <div className="text-6xl mb-3">🔥</div>
          <h2 className="font-display text-2xl font-black neon-text-pink mb-1">熔炉锻造完成</h2>
          <p className="text-stardust/60 text-sm mb-5">本轮复习 {queue.length} 题，答对 {correctCount} 题</p>
          <NeonButton variant="primary" onClick={() => navigate('/mistakes')} className="w-full">返回错题炉</NeonButton>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
        <h1 className="font-display text-2xl font-black neon-text-pink">错题熔炉</h1>
        <p className="text-[11px] text-stardust/50 font-mono mt-1">MISTAKE FORGE · 间隔重复 · 巩固记忆</p>
      </motion.div>

      {/* 总览数据 */}
      <div className="grid grid-cols-3 gap-2">
        <GlassCard className="p-3 text-center">
          <div className="text-2xl font-display font-black text-neon-red">{allCards.length}</div>
          <div className="text-[10px] text-stardust/60 mt-0.5">未掌握</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <div className="text-2xl font-display font-black text-neon-gold">{dueCards.length}</div>
          <div className="text-[10px] text-stardust/60 mt-0.5">到期复习</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <div className="text-2xl font-display font-black text-neon-green">{masteredCount}</div>
          <div className="text-[10px] text-stardust/60 mt-0.5">已掌握</div>
        </GlassCard>
      </div>

      {/* 主行动 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong p-5 rounded-3xl text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neon-red/10 to-neon-gold/10" />
        <div className="relative">
          <div className="text-5xl mb-2 animate-float">🔥</div>
          <h2 className="font-display text-lg font-bold neon-text-gold mb-1">今日锻造</h2>
          <p className="text-xs text-stardust/60 mb-4">{dueCards.length} 道错题等待你巩固</p>
          <NeonButton
            variant={dueCards.length > 0 ? 'primary' : 'ghost'}
            onClick={() => startReview(dueCards)}
            disabled={dueCards.length === 0}
            className="w-full"
          >
            {dueCards.length > 0 ? `开始复习 (${dueCards.length})` : '暂无到期错题'}
          </NeonButton>
        </div>
      </motion.div>

      {/* 顽固错题 Lv3 */}
      {lv3Cards.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-sm neon-text-red">⚠️ 顽固错题 (Lv3)</h3>
            <span className="text-[10px] text-stardust/50 font-mono">{lv3Cards.length} 题</span>
          </div>
          <div className="space-y-2">
            {lv3Cards.slice(0, 5).map((c) => {
              const q = getQuestion(c.questionId)
              if (!q) return null
              return (
                <GlassCard key={c.questionId} className="p-3 border-l-2" >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stardust/80 line-clamp-1">{q.question}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-red/20 text-neon-red">错 {c.wrongCount} 次</span>
                        <span className="text-[9px] text-stardust/40 font-mono">下次 {getDaysUntilReview(c)}d</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
            <NeonButton variant="danger" onClick={() => startReview(lv3Cards)} className="w-full text-xs">
              专攻顽固错题 ({lv3Cards.length})
            </NeonButton>
          </div>
        </section>
      )}

      {/* 按执照分组 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-cyan mb-2">按执照分布</h3>
        <div className="space-y-2">
          {LICENSES.map((lic) => {
            const cards = byLicense[lic.id]
            if (cards.length === 0) return null
            return (
              <GlassCard key={lic.id} className="p-3 flex items-center gap-3">
                <span className="text-2xl">{lic.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-tech" style={{ color: lic.color }}>{lic.name}</div>
                  <div className="text-[10px] text-stardust/50">{cards.length} 道未掌握</div>
                </div>
                <NeonButton variant="ghost" onClick={() => startReview(cards.filter(isDueForReview))} className="text-xs px-3 py-1.5">
                  复习到期
                </NeonButton>
              </GlassCard>
            )
          })}
          {allCards.length === 0 && (
            <GlassCard className="p-8 text-center">
              <div className="text-4xl mb-2">✨</div>
              <p className="text-sm text-stardust/60">还没有错题，去答题收集吧！</p>
              <NeonButton variant="secondary" onClick={() => navigate('/')} className="mt-3 text-xs">前往星球大厅</NeonButton>
            </GlassCard>
          )}
        </div>
      </section>
    </div>
  )
}

function ReviewSession({
  q, card, idx, total, selected, locked, onSelect, onNext, correctGlow, wrongShake, coinBurst, onExit, ttsEnabled,
}: {
  q: ReturnType<typeof getQuestion>
  card: MistakeCard
  idx: number
  total: number
  selected: string | null
  locked: boolean
  onSelect: (opt: string) => void
  onNext: () => void
  correctGlow: number
  wrongShake: number
  coinBurst: number
  onExit: () => void
  ttsEnabled: boolean
}) {
  if (!q) return null
  const correctOpt = q.options[q.answer.charCodeAt(0) - 65] || q.answer
  const isCorrect = selected === correctOpt || selected === q.answer
  const progress = ((idx + (locked ? 1 : 0)) / total) * 100
  const mastery = getMasteryProgress(card)

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-30 pt-3 px-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={onExit} className="glass px-3 py-2 rounded-xl text-stardust/70 hover:text-neon-pink">✕</button>
          <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-neon-red to-neon-gold" animate={{ width: `${progress}%` }} />
          </div>
          <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-1">
            <ProgressRing progress={mastery} size={28} stroke={3} color="#ff2e88">
              <span className="text-[9px]">Lv{card.level}</span>
            </ProgressRing>
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-1.5 text-center">
          <span className="text-[10px] font-mono text-stardust/50">错题复习 {idx + 1} / {total}</span>
        </div>
      </div>

      <div className="flex-1 pt-24 pb-6 px-3 max-w-3xl mx-auto w-full">
        <WrongShake trigger={wrongShake}>
          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <GlassCard className="p-5 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-red/20 text-neon-red font-bold">错过 {card.wrongCount} 次</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-gold/20 text-neon-gold">Lv{card.level}</span>
                </div>
                <p className="text-base leading-relaxed text-stardust">{q.question}</p>
                {ttsEnabled && (
                  <button onClick={() => speak(q.question)} className="mt-2 text-[11px] text-neon-cyan">🔊 朗读</button>
                )}
              </GlassCard>

              <div className="space-y-2.5">
                {q.options.map((opt, i) => {
                  const isAns = opt === (q.options[q.answer.charCodeAt(0) - 65] || q.answer) || opt === q.answer
                  const isPicked = opt === selected
                  let cls = 'glass hover:border-white/30'
                  if (locked) {
                    if (isAns) cls = 'border-neon-green/70 bg-neon-green/10 shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                    else if (isPicked) cls = 'border-neon-red/70 bg-neon-red/10'
                    else cls = 'opacity-40'
                  }
                  return (
                    <motion.button
                      key={opt}
                      whileTap={{ scale: locked ? 1 : 0.97 }}
                      onClick={() => onSelect(opt)}
                      disabled={locked}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${cls}`}
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm bg-white/5 text-stardust">
                        {locked && isAns ? '✓' : locked && isPicked ? '✗' : String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm text-stardust flex-1">{opt.replace(/^[A-D][.、)]\s*/, '')}</span>
                    </motion.button>
                  )
                })}
              </div>

              <AnimatePresence>
                {locked && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                    <div className="glass p-4 rounded-2xl" style={{ borderLeft: '2px solid #00f5ff' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">💡</span>
                        <span className="font-tech font-bold text-sm neon-text-cyan">解析</span>
                      </div>
                      <p className="text-sm text-stardust/80 leading-relaxed">{q.explanation}</p>
                    </div>
                    <NeonButton onClick={onNext} variant={isCorrect ? 'primary' : 'secondary'} className="w-full">
                      {idx + 1 >= total ? '完成复习 🏁' : '下一题 →'}
                    </NeonButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </WrongShake>
      </div>

      <CoinBurst trigger={coinBurst} />
      <CorrectGlow trigger={correctGlow} />
    </div>
  )
}
