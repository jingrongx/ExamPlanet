import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { getLicense, getQuestionsByLicense } from '../data/licenses'
import { useGameStore } from '../store/useGameStore'
import { GlassCard, NeonButton, Modal, useToast } from '../components/ui'
import { playButton, playCorrect, playWrong, playStageClear, speak, stopSpeak } from '../engine/audio'
import type { Question } from '../types'

const EXAM_LENGTH = 20
const EXAM_TIME_SEC = 20 * 60 // 20 分钟

export function Exam() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { answer, settings } = useGameStore()

  const license = id ? getLicense(id as any) : null
  const examQuestions = useMemo<Question[]>(() => {
    if (!id) return []
    const all = getQuestionsByLicense(id as any)
    // 随机抽取 EXAM_LENGTH 题，按 category 打乱
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(EXAM_LENGTH, shuffled.length))
  }, [id])

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME_SEC)

  // 倒计时
  useEffect(() => {
    if (submitted) return
    if (timeLeft <= 0) {
      handleSubmit()
      return
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, submitted])

  const q = examQuestions[idx]

  const selectOption = useCallback((opt: string) => {
    if (submitted || !q) return
    playButton()
    setAnswers((a) => ({ ...a, [q.id]: opt }))
  }, [submitted, q])

  const goPrev = () => { if (idx > 0) { playButton(); setIdx((i) => i - 1) } }
  const goNext = () => { if (idx < examQuestions.length - 1) { playButton(); setIdx((i) => i + 1) } }

  const handleSubmit = useCallback(() => {
    if (submitted) return
    setSubmitted(true)
    stopSpeak()
    // 计分并记录
    let correct = 0
    for (const question of examQuestions) {
      const picked = answers[question.id]
      const correctOpt = question.options[question.answer.charCodeAt(0) - 65] || question.answer
      const isCorrect = picked === correctOpt || picked === question.answer
      if (isCorrect) correct++
      // 记录到 store（quality 不影响 SRS 因 exam 不进错题炉的 quality 判断）
      answer(question.id, isCorrect, isCorrect ? 4 : 1, 10000)
    }
    playStageClear()
    // 跳转结果页
    setTimeout(() => {
      navigate(`/exam/${license?.id}/result`, {
        state: {
          correct,
          total: examQuestions.length,
          answers,
          questions: examQuestions.map((q) => ({ id: q.id, category: q.category, answer: q.answer, question: q.question, options: q.options, explanation: q.explanation })),
        },
      })
    }, 400)
  }, [submitted, examQuestions, answers, answer, navigate, license])

  if (!license || examQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-stardust/60">加载考试题目...</p>
        </div>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')
  const lowTime = timeLeft < 60

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部 */}
      <div className="fixed top-0 left-0 right-0 z-30 pt-3 px-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => { stopSpeak(); setShowConfirm(true) }}
            className="glass px-3 py-2 rounded-xl text-stardust/70 hover:text-neon-pink"
          >
            ✕
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-mono text-stardust/50">{license.name} · 模拟考试</div>
            <div className={`font-display font-black text-lg tabular-nums ${lowTime ? 'text-neon-red animate-pulse' : 'text-neon-cyan'}`}>
              {mm}:{ss}
            </div>
          </div>
          <NeonButton variant="secondary" onClick={() => setShowConfirm(true)} className="text-xs px-3 py-2">
            交卷
          </NeonButton>
        </div>
        {/* 答题卡 */}
        <div className="max-w-3xl mx-auto mt-2 flex gap-1 overflow-x-auto pb-1">
          {examQuestions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => { playButton(); setIdx(i) }}
              className={`flex-shrink-0 w-7 h-7 rounded-lg text-[11px] font-mono flex items-center justify-center transition-all ${
                i === idx ? 'bg-neon-pink text-white' : answers[qq.id] ? 'bg-neon-cyan/30 text-neon-cyan' : 'glass text-stardust/50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* 题目主体 */}
      <div className="flex-1 pt-28 pb-6 px-3 max-w-3xl mx-auto w-full">
        <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <GlassCard className="p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink font-bold">第 {idx + 1} 题</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full glass text-stardust/60">{q.category}</span>
            </div>
            <p className="text-base leading-relaxed text-stardust">{q.question}</p>
            {settings.ttsEnabled && (
              <button onClick={() => speak(q.question)} className="mt-2 text-[11px] text-neon-cyan">🔊 朗读</button>
            )}
          </GlassCard>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const picked = answers[q.id] === opt
              return (
                <motion.button
                  key={opt}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectOption(opt)}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    picked
                      ? 'border-neon-pink/70 bg-neon-pink/10 shadow-[0_0_16px_rgba(255,46,136,0.3)]'
                      : 'glass hover:border-white/30'
                  }`}
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm bg-white/5 text-stardust">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm text-stardust flex-1">{opt}</span>
                  {picked && <span className="text-neon-pink">●</span>}
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* 上下题 */}
        <div className="flex gap-2 mt-5">
          <NeonButton variant="ghost" onClick={goPrev} disabled={idx === 0} className="flex-1 text-xs">← 上一题</NeonButton>
          {idx === examQuestions.length - 1 ? (
            <NeonButton variant="primary" onClick={() => setShowConfirm(true)} className="flex-1 text-xs">交卷 ({answeredCount}/{examQuestions.length})</NeonButton>
          ) : (
            <NeonButton variant="primary" onClick={goNext} className="flex-1 text-xs">下一题 →</NeonButton>
          )}
        </div>
      </div>

      {/* 交卷确认 */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="确认交卷">
        <div className="text-center py-2">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm text-stardust/80 mb-1">已完成 {answeredCount} / {examQuestions.length} 题</p>
          {answeredCount < examQuestions.length && (
            <p className="text-xs text-neon-red mb-4">还有 {examQuestions.length - answeredCount} 题未作答</p>
          )}
          <div className="flex gap-2 mt-4">
            <NeonButton variant="ghost" onClick={() => setShowConfirm(false)} className="flex-1 text-xs">继续答题</NeonButton>
            <NeonButton variant="primary" onClick={handleSubmit} className="flex-1 text-xs">确认交卷</NeonButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
