import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { getLicense, getQuestionsByChapter } from '../data/licenses'
import { useGameStore, getRankByExp } from '../store/useGameStore'
import { getMnemonic, generateMnemonic } from '../engine/mnemonic'
import { NeonButton, GlassCard, useToast } from '../components/ui'
import {
  playCorrect, playWrong, playCoin, playCombo, playCrit, playStageClear,
  speak, stopSpeak, playButton,
} from '../engine/audio'
import { CoinBurst, ComboFlash, CritFlash, WrongShake, CorrectGlow, RankUpBanner } from '../components/effects/Effects'
import type { Question } from '../types'

export function Quiz() {
  const { id, nodeId } = useParams<{ id: string; nodeId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { answer, settings, combo, passNode, nodeProgress } = useGameStore()

  const license = id ? getLicense(id as any) : null
  const questions = useMemo<Question[]>(() => {
    if (!nodeId) return []
    return getQuestionsByChapter(nodeId).slice(0, 10) // 每关卡 10 题
  }, [nodeId])

  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [startTime, setStartTime] = useState(Date.now())
  const [correctCount, setCorrectCount] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [coinBurst, setCoinBurst] = useState(0)
  const [critTrigger, setCritTrigger] = useState(0)
  const [correctGlow, setCorrectGlow] = useState(0)
  const [wrongShake, setWrongShake] = useState(0)
  const [rankUpTrigger, setRankUpTrigger] = useState(0)
  const [rankUpName, setRankUpName] = useState('')

  const q = questions[idx]

  useEffect(() => {
    setStartTime(Date.now())
    setSelected(null)
    setLocked(false)
  }, [idx])

  const handleSelect = useCallback((opt: string) => {
    if (locked || !q) return
    setSelected(opt)
    setLocked(true)
    const timeSpent = Date.now() - startTime
    const isCorrect = opt === q.answer
    const quality = isCorrect ? (timeSpent < 8000 ? 5 : 4) : 1

    const result = answer(q.id, isCorrect, quality, timeSpent)

    if (isCorrect) {
      setCorrectCount((c) => c + 1)
      setCorrectGlow((x) => x + 1)
      playCorrect()
      setTimeout(() => playCoin(), 150)
      setCoinBurst((x) => x + 1)
      if (result.isCrit) {
        setCritTrigger((x) => x + 1)
        setTimeout(() => playCrit(), 100)
        toast('💥 暴击！双倍奖励', 'reward')
      }
      if (result.comboBonus > 0) {
        setTimeout(() => playCombo(combo + 1), 200)
      }
      if (result.masteredNow) {
        toast('🎓 错题已掌握！+50 金币', 'reward')
      }
      if (result.rankUp) {
        setRankUpName(getRankByExp(useGameStore.getState().exp).name)
        setRankUpTrigger((x) => x + 1)
      }
    } else {
      setWrongShake((x) => x + 1)
      playWrong()
      toast(`答错 · 正确答案：${q.answer}`, 'error')
    }

    if (settings.ttsEnabled) {
      setTimeout(() => speak(q.explanation), 600)
    }
  }, [locked, q, startTime, answer, combo, settings.ttsEnabled, toast])

  const next = useCallback(() => {
    stopSpeak()
    playButton()
    if (idx + 1 >= questions.length) {
      // 完成
      const perfect = correctCount === questions.length
      const passed = correctCount >= Math.ceil(questions.length * 0.6)
      if (nodeId) {
        passNode(nodeId, perfect)
      }
      playStageClear()
      setShowResult(true)
    } else {
      setIdx((i) => i + 1)
    }
  }, [idx, questions.length, correctCount, nodeId, passNode])

  if (!license || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🛸</div>
          <p className="text-stardust/60">题目加载中...</p>
        </div>
      </div>
    )
  }

  if (showResult) {
    return <QuizResult
      correct={correctCount}
      total={questions.length}
      onBack={() => navigate(`/license/${license.id}`)}
      onRetry={() => { setShowResult(false); setIdx(0); setCorrectCount(0) }}
    />
  }

  const progress = ((idx + (locked ? 1 : 0)) / questions.length) * 100
  const isCorrect = selected === q?.answer
  const mnemonic = q ? (getMnemonic(q.id) || generateMnemonic(q.question, q.answer, q.explanation)[0]) : ''

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部进度条 */}
      <div className="fixed top-0 left-0 right-0 z-30 pt-3 px-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => { stopSpeak(); playButton(); navigate(`/license/${license.id}`) }}
            className="glass px-3 py-2 rounded-xl text-stardust/70 hover:text-neon-pink"
          >
            ✕
          </button>
          <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${license.color}, #ff2e88)` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span className="text-sm">🔥</span>
            <span className="font-tech font-bold text-neon-gold text-sm tabular-nums">{combo}</span>
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-1.5 text-center">
          <span className="text-[10px] font-mono text-stardust/50">{idx + 1} / {questions.length} · {license.name}</span>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 pt-24 pb-6 px-3 max-w-3xl mx-auto w-full">
        <WrongShake trigger={wrongShake}>
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {/* 题干 */}
              <GlassCard className="p-5 mb-4" glow={locked && isCorrect}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-lg"
                    style={{ background: `${license.color}20`, color: license.color, border: `1px solid ${license.color}50` }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-base leading-relaxed text-stardust">{q?.question}</p>
                    {settings.ttsEnabled && (
                      <button
                        onClick={() => speak(q?.question || '')}
                        className="mt-2 text-[11px] text-neon-cyan hover:text-neon-pink"
                      >
                        🔊 朗读题目
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>

              {/* 选项 */}
              <div className="space-y-2.5">
                {q?.options.map((opt, i) => {
                  const isAns = opt === q.answer
                  const isPicked = opt === selected
                  let cls = 'glass hover:border-white/30'
                  let prefix = String.fromCharCode(65 + i)
                  if (locked) {
                    if (isAns) cls = 'border-neon-green/70 bg-neon-green/10 shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                    else if (isPicked) cls = 'border-neon-red/70 bg-neon-red/10'
                    else cls = 'opacity-40'
                  }
                  return (
                    <motion.button
                      key={opt}
                      whileTap={{ scale: locked ? 1 : 0.97 }}
                      onClick={() => handleSelect(opt)}
                      disabled={locked}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${cls}`}
                    >
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm"
                        style={{
                          background: locked && isAns ? '#39ff1420' : locked && isPicked ? '#ff386020' : 'rgba(255,255,255,0.05)',
                          color: locked && isAns ? '#39ff14' : locked && isPicked ? '#ff3860' : '#e0e0ff',
                        }}
                      >
                        {locked && isAns ? '✓' : locked && isPicked ? '✗' : prefix}
                      </span>
                      <span className="text-sm text-stardust flex-1">{opt}</span>
                    </motion.button>
                  )
                })}
              </div>

              {/* 解析 + 口诀 */}
              <AnimatePresence>
                {locked && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    className="mt-4 space-y-3"
                  >
                    <GlassCard className="p-4 border-l-2" >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">💡</span>
                        <span className="font-tech font-bold text-sm neon-text-cyan">解析</span>
                      </div>
                      <p className="text-sm text-stardust/80 leading-relaxed">{q?.explanation}</p>
                    </GlassCard>
                    <div className="glass p-4 rounded-2xl" style={{ borderLeft: '2px solid #ffd700' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">🧠</span>
                        <span className="font-tech font-bold text-sm neon-text-gold">记忆口诀</span>
                      </div>
                      <p className="text-sm text-stardust/80 leading-relaxed">{mnemonic}</p>
                    </div>
                    <NeonButton onClick={next} className="w-full" variant={isCorrect ? 'primary' : 'secondary'}>
                      {idx + 1 >= questions.length ? '完成关卡 🏁' : '下一题 →'}
                    </NeonButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </WrongShake>
      </div>

      {/* 特效层 */}
      <CoinBurst trigger={coinBurst} />
      <ComboFlash combo={combo} />
      <CritFlash trigger={critTrigger} />
      <CorrectGlow trigger={correctGlow} />
      <RankUpBanner trigger={rankUpTrigger} rankName={rankUpName} />
    </div>
  )
}

function QuizResult({ correct, total, onBack, onRetry }: { correct: number; total: number; onBack: () => void; onRetry: () => void }) {
  const pct = Math.round((correct / total) * 100)
  const perfect = correct === total
  const passed = pct >= 60
  const stars = perfect ? 3 : pct >= 80 ? 2 : passed ? 1 : 0

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-strong p-8 rounded-3xl max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="text-7xl mb-3"
        >
          {perfect ? '🏆' : passed ? '🎉' : '💪'}
        </motion.div>
        <h2 className="font-display text-2xl font-black mb-1" style={{ color: perfect ? '#ffd700' : passed ? '#39ff14' : '#ff2e88' }}>
          {perfect ? '完美通关！' : passed ? '关卡通过！' : '再接再厉'}
        </h2>
        <p className="text-stardust/60 text-sm mb-5">{correct}/{total} 正确</p>

        {/* 星星 */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: i < stars ? 1 : 0.5, y: 0 }}
              transition={{ delay: 0.4 + i * 0.15, type: 'spring' }}
              className="text-4xl"
              style={{ filter: i < stars ? 'drop-shadow(0 0 12px #ffd700)' : 'grayscale(1) opacity(0.3)' }}
            >
              ⭐
            </motion.div>
          ))}
        </div>

        {/* 进度环 */}
        <div className="mb-6">
          <div className="text-5xl font-display font-black" style={{ color: perfect ? '#ffd700' : passed ? '#39ff14' : '#ff3860' }}>
            {pct}%
          </div>
          <div className="text-[11px] text-stardust/50 font-mono mt-1">正确率</div>
        </div>

        <div className="flex gap-2">
          <NeonButton variant="ghost" onClick={onRetry} className="flex-1">重做</NeonButton>
          <NeonButton variant="primary" onClick={onBack} className="flex-1">返回地图</NeonButton>
        </div>
      </motion.div>
    </div>
  )
}
