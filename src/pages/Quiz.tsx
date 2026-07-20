import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { getLicense, getQuestionsByChapter } from '../data/licenses'
import { useGameStore, getRankByExp } from '../store/useGameStore'
import { NeonButton, GlassCard, useToast } from '../components/ui'
import {
  playCorrect, playWrong, playCoin, playCombo, playCrit, playStageClear,
  speak, stopSpeak, playButton,
} from '../engine/audio'
import { CoinBurst, ComboFlash, CritFlash, WrongShake, CorrectGlow, RankUpBanner } from '../components/effects/Effects'
import { streamInterpretQuestion } from '../services/ai'
import { streamMnemonic } from '../services/mnemonic'
import type { Question } from '../types'

// 判断是否多选题：type === 'multi' 或 answer 多于 1 个字母
function isMultiChoice(q: Question): boolean {
  return q.type === 'multi' || q.answer.toUpperCase().replace(/[^A-D]/g, '').length > 1
}

// 把选项文本转换为对应的字母
function optionToLetter(opt: string, options: string[]): string {
  const idx = options.indexOf(opt)
  return idx >= 0 ? String.fromCharCode(65 + idx) : ''
}

// 去除选项自带的 A. 前缀
function cleanOption(opt: string): string {
  return opt.replace(/^[A-D][.、)]\s*/, '')
}

export function Quiz() {
  const { id, nodeId } = useParams<{ id: string; nodeId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { answer, settings, combo, passNode, aiInterpretCache, setAiInterpret, mnemonicCache, setMnemonic } = useGameStore()

  const license = id ? getLicense(id as any) : null
  const questions = useMemo<Question[]>(() => {
    if (!nodeId) return []
    return getQuestionsByChapter(nodeId).slice(0, 10) // 每关卡 10 题
  }, [nodeId])

  const [idx, setIdx] = useState(0)
  // 单选：存一个选项；多选：存多个选项
  const [selected, setSelected] = useState<string[]>([])
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

  // AI 解读相关
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiAbortRef = useRef<AbortController | null>(null)
  // 记录最近一次作答信息，供 AI 解读使用
  const lastAnswerRef = useRef<{ userLetters: string; correct: boolean }>({ userLetters: '', correct: false })

  // AI 记忆口诀相关
  const [mnemoText, setMnemoText] = useState('')
  const [mnemoLoading, setMnemoLoading] = useState(false)
  const mnemoAbortRef = useRef<AbortController | null>(null)

  const q = questions[idx]
  const multi = q ? isMultiChoice(q) : false

  useEffect(() => {
    setStartTime(Date.now())
    setSelected([])
    setLocked(false)
    // 切题时重置 AI 解读状态；如果缓存中有，直接展示缓存内容
    setAiLoading(false)
    if (aiAbortRef.current) {
      aiAbortRef.current.abort()
      aiAbortRef.current = null
    }
    const cached = q ? (aiInterpretCache[q.id] || '') : ''
    setAiText(cached)
    // 同步重置记忆口诀状态
    setMnemoLoading(false)
    if (mnemoAbortRef.current) {
      mnemoAbortRef.current.abort()
      mnemoAbortRef.current = null
    }
    const cachedMnemo = q ? (mnemonicCache[q.id] || '') : ''
    setMnemoText(cachedMnemo)
  }, [idx])

  // 组件卸载时取消 AI 请求
  useEffect(() => {
    return () => {
      if (aiAbortRef.current) {
        aiAbortRef.current.abort()
      }
      if (mnemoAbortRef.current) {
        mnemoAbortRef.current.abort()
      }
    }
  }, [])

  // 触发 AI 解读（force=true 时强制重新生成，忽略缓存）
  const triggerAiInterpret = useCallback(async (question: Question, userAnsLetters: string, correct: boolean, force: boolean = false) => {
    if (!settings.aiInterpretEnabled) return
    if (!settings.deepseekApiKey) {
      setAiText('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后开启 AI 解读。')
      return
    }
    // 命中缓存且非强制刷新：直接展示缓存
    if (!force) {
      const cached = aiInterpretCache[question.id]
      if (cached) {
        setAiText(cached)
        return
      }
    }
    // 取消上一个请求
    if (aiAbortRef.current) aiAbortRef.current.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller

    setAiLoading(true)
    setAiText('')
    let firstChunk = true
    let accumulated = ''
    await streamInterpretQuestion(
      {
        question: question.question,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        type: isMultiChoice(question) ? 'multi' : 'single',
        userAnswer: userAnsLetters,
        isCorrect: correct,
        licenseName: license?.name,
      },
      settings.deepseekApiKey,
      (chunk) => {
        if (firstChunk) {
          setAiLoading(false)
          firstChunk = false
        }
        accumulated += chunk
        setAiText(accumulated)
      },
      controller.signal,
    )
    if (firstChunk) setAiLoading(false)
    // 完成后保存到缓存（仅当有内容且非错误提示）
    if (accumulated && !accumulated.startsWith('⚠️')) {
      setAiInterpret(question.id, accumulated)
    }
  }, [settings.aiInterpretEnabled, settings.deepseekApiKey, license?.name, aiInterpretCache, setAiInterpret])

  // 触发 AI 记忆口诀生成（force=true 时强制重新生成，忽略缓存）
  const triggerMnemonic = useCallback(async (question: Question, force: boolean = false) => {
    if (!settings.deepseekApiKey) {
      setMnemoText('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再生成 AI 口诀。')
      return
    }
    // 命中缓存且非强制刷新：直接展示缓存
    if (!force) {
      const cached = mnemonicCache[question.id]
      if (cached) {
        setMnemoText(cached)
        return
      }
    }
    // 取消上一个请求
    if (mnemoAbortRef.current) mnemoAbortRef.current.abort()
    const controller = new AbortController()
    mnemoAbortRef.current = controller

    setMnemoLoading(true)
    setMnemoText('')
    let firstChunk = true
    let accumulated = ''
    await streamMnemonic(
      {
        question: question.question,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        type: isMultiChoice(question) ? 'multi' : 'single',
        licenseName: license?.name,
      },
      settings.deepseekApiKey,
      (chunk) => {
        if (firstChunk) {
          setMnemoLoading(false)
          firstChunk = false
        }
        accumulated += chunk
        setMnemoText(accumulated)
      },
      controller.signal,
    )
    if (firstChunk) setMnemoLoading(false)
    // 完成后保存到缓存（仅当有内容且非错误提示）
    if (accumulated && !accumulated.startsWith('⚠️')) {
      setMnemonic(question.id, accumulated)
    }
  }, [settings.deepseekApiKey, license?.name, mnemonicCache, setMnemonic])

  const commitAnswer = useCallback((opts: string[]) => {
    if (!q || opts.length === 0) return
    setSelected(opts)
    setLocked(true)
    const timeSpent = Date.now() - startTime

    // 计算 user 答案字母与正确字母集合
    const userLetters = opts.map((o) => optionToLetter(o, q.options)).filter(Boolean).sort().join('').toUpperCase()
    const correctLetters = q.answer.toUpperCase().replace(/[^A-D]/g, '').split('').sort().join('')
    const isCorrect = userLetters === correctLetters

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
      // 显示正确答案（多选展示全部，单选展示对应选项文本）
      const correctOptTexts = correctLetters.split('').map((l) => {
        const i = l.charCodeAt(0) - 65
        return q.options[i] ? cleanOption(q.options[i]) : l
      })
      toast(`答错 · 正确答案：${correctLetters.split('').join('、')} ${correctOptTexts.join('｜')}`, 'error')
    }

    if (settings.ttsEnabled) {
      setTimeout(() => speak(q.explanation), 600)
    }

    // 记录作答信息，等待用户点击 AI 解读按钮时使用
    lastAnswerRef.current = { userLetters, correct: isCorrect }
  }, [q, startTime, answer, combo, settings.ttsEnabled, toast, triggerAiInterpret])

  const handleSelect = useCallback((opt: string) => {
    if (locked || !q) return
    if (multi) {
      // 多选：切换选中
      setSelected((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt],
      )
    } else {
      // 单选：直接作答
      commitAnswer([opt])
    }
  }, [locked, q, multi, commitAnswer])

  const next = useCallback(() => {
    stopSpeak()
    playButton()
    // 取消未完成的 AI 请求
    if (aiAbortRef.current) {
      aiAbortRef.current.abort()
      aiAbortRef.current = null
    }
    if (mnemoAbortRef.current) {
      mnemoAbortRef.current.abort()
      mnemoAbortRef.current = null
    }
    if (idx + 1 >= questions.length) {
      // 完成
      const perfect = correctCount === questions.length
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
  // 正确字母集合
  const correctLetters = q.answer.toUpperCase().replace(/[^A-D]/g, '').split('').sort().join('')
  // 用户字母集合
  const userLetters = selected.map((o) => optionToLetter(o, q.options)).filter(Boolean).sort().join('').toUpperCase()
  const isCorrect = locked && userLetters === correctLetters
  const canSubmitMulti = multi && !locked && selected.length >= 1

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部进度条 */}
      <div className="fixed top-0 left-0 right-0 z-30 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}>
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
          <span className="text-[10px] font-mono text-stardust/50">
            {idx + 1} / {questions.length} · {license.name}
          </span>
          {multi && (
            <span
              className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,46,136,0.15)', color: '#ff2e88', border: '1px solid rgba(255,46,136,0.4)' }}
            >
              多选题
            </span>
          )}
          {!multi && (
            <span
              className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,245,255,0.12)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.35)' }}
            >
              单选题
            </span>
          )}
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 px-3 max-w-3xl mx-auto w-full" style={{ paddingTop: 'calc(var(--safe-top) + 5rem)', paddingBottom: 'calc(var(--safe-bottom) + 5rem)' }}>
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
                    {multi && (
                      <div className="mt-1.5 text-[11px] text-neon-pink/80">
                        ⓘ 多选题：可勾选多个选项，下方「确认答案」提交
                      </div>
                    )}
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
                  const cleanOpt = cleanOption(opt)
                  const letter = String.fromCharCode(65 + i)
                  const isAns = correctLetters.includes(letter)
                  const isPicked = selected.includes(opt)
                  let cls = 'glass hover:border-white/30'
                  if (locked) {
                    if (isAns) cls = 'border-neon-green/70 bg-neon-green/10 shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                    else if (isPicked) cls = 'border-neon-red/70 bg-neon-red/10'
                    else cls = 'opacity-40'
                  } else if (multi && isPicked) {
                    cls = 'border-neon-cyan/70 bg-neon-cyan/10'
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
                          background: locked && isAns ? '#39ff1420' : locked && isPicked ? '#ff386020' : (multi && isPicked) ? '#00f5ff20' : 'rgba(255,255,255,0.05)',
                          color: locked && isAns ? '#39ff14' : locked && isPicked ? '#ff3860' : (multi && isPicked) ? '#00f5ff' : '#e0e0ff',
                        }}
                      >
                        {locked && isAns ? '✓' : locked && isPicked ? '✗' : (multi && isPicked) ? '✓' : letter}
                      </span>
                      <span className="text-sm text-stardust flex-1">{cleanOpt}</span>
                    </motion.button>
                  )
                })}
              </div>

              {/* 多选提交按钮 */}
              <AnimatePresence>
                {canSubmitMulti && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3"
                  >
                    <NeonButton
                      variant="primary"
                      onClick={() => commitAnswer(selected)}
                      className="w-full text-sm"
                    >
                      确认答案（已选 {selected.length} 项）
                    </NeonButton>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 解析 + 口诀 + AI 解读 */}
              <AnimatePresence>
                {locked && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    className="mt-4 space-y-3"
                  >
                    <GlassCard className="p-4 border-l-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">💡</span>
                        <span className="font-tech font-bold text-sm neon-text-cyan">解析</span>
                      </div>
                      <p className="text-sm text-stardust/80 leading-relaxed">{q?.explanation}</p>
                    </GlassCard>
                    <div className="glass p-4 rounded-2xl" style={{ borderLeft: '2px solid #ffd700' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🧠</span>
                          <span className="font-tech font-bold text-sm neon-text-gold">记忆口诀 · AI</span>
                          {mnemoText && !mnemoLoading && !mnemoText.startsWith('⚠️') && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-gold/15 text-neon-gold/80">
                              {mnemonicCache[q?.id || ''] ? '已缓存' : '已生成'}
                            </span>
                          )}
                        </div>
                        {mnemoLoading && (
                          <span className="text-[10px] text-stardust/50 animate-pulse">编口中…</span>
                        )}
                      </div>

                      {/* 状态分支：加载中 / 有文本 / 空闲 */}
                      {mnemoLoading && !mnemoText ? (
                        <div className="flex items-center gap-1.5 text-xs text-stardust/50">
                          <motion.span
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          >
                            正在为你编口诀…
                          </motion.span>
                        </div>
                      ) : mnemoText ? (
                        <>
                          <div className="text-sm text-stardust/85 leading-relaxed whitespace-pre-wrap break-words">
                            {renderMnemonicText(mnemoText)}
                          </div>
                          {/* 重新生成按钮 */}
                          {!mnemoLoading && !mnemoText.startsWith('⚠️') && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => {
                                  playButton()
                                  if (!q) return
                                  triggerMnemonic(q, true)
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-lg glass text-neon-gold hover:text-neon-cyan transition-colors"
                              >
                                🔄 重新生成
                              </button>
                            </div>
                          )}
                          {/* 错误提示重试 */}
                          {!mnemoLoading && mnemoText.startsWith('⚠️') && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  playButton()
                                  if (!q) return
                                  triggerMnemonic(q, true)
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-lg glass text-neon-cyan hover:text-neon-gold transition-colors"
                              >
                                🔁 重试
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-stardust/40 mb-2.5">
                            {settings.deepseekApiKey
                              ? '点击下方按钮让 AI 为本题编 4 段口诀（谐音 / 场景 / 押韵 / 公式，仅生成一次，自动缓存）'
                              : '⚠️ 请先在「设置」中配置 DeepSeek API Key'}
                          </div>
                          {settings.deepseekApiKey && (
                            <button
                              onClick={() => {
                                playButton()
                                if (!q) return
                                triggerMnemonic(q)
                              }}
                              className="text-xs px-3 py-2 rounded-xl font-tech font-bold"
                              style={{
                                background: 'rgba(255,215,0,0.12)',
                                color: '#ffd700',
                                border: '1px solid rgba(255,215,0,0.45)',
                              }}
                            >
                              🧠 点击生成 AI 口诀
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* AI 解读 */}
                    {settings.aiInterpretEnabled && (
                      <div className="glass p-4 rounded-2xl" style={{ borderLeft: '2px solid #ff2e88' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🤖</span>
                            <span className="font-tech font-bold text-sm neon-text-pink">AI 解读 · DeepSeek V4-Flash</span>
                            {aiText && !aiLoading && !aiText.startsWith('⚠️') && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-cyan/15 text-neon-cyan/80">
                                {aiInterpretCache[q?.id || ''] ? '已缓存' : '已生成'}
                              </span>
                            )}
                          </div>
                          {aiLoading && (
                            <span className="text-[10px] text-stardust/50 animate-pulse">思考中...</span>
                          )}
                        </div>

                        {/* 状态分支：加载中 / 有文本 / 空闲 */}
                        {aiLoading && !aiText ? (
                          <div className="flex items-center gap-1.5 text-xs text-stardust/50">
                            <motion.span
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity }}
                            >
                              正在生成解读…
                            </motion.span>
                          </div>
                        ) : aiText ? (
                          <>
                            <div className="text-sm text-stardust/85 leading-relaxed whitespace-pre-wrap break-words">
                              {renderAiText(aiText)}
                            </div>
                            {/* 重新生成按钮 */}
                            {!aiLoading && !aiText.startsWith('⚠️') && (
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => {
                                    playButton()
                                    if (!q) return
                                    triggerAiInterpret(q, lastAnswerRef.current.userLetters, lastAnswerRef.current.correct, true)
                                  }}
                                  className="text-[11px] px-3 py-1.5 rounded-lg glass text-neon-pink hover:text-neon-cyan transition-colors"
                                >
                                  🔄 重新生成
                                </button>
                              </div>
                            )}
                            {/* 错误提示重试 */}
                            {!aiLoading && aiText.startsWith('⚠️') && (
                              <div className="mt-3">
                                <button
                                  onClick={() => {
                                    playButton()
                                    if (!q) return
                                    triggerAiInterpret(q, lastAnswerRef.current.userLetters, lastAnswerRef.current.correct, true)
                                  }}
                                  className="text-[11px] px-3 py-1.5 rounded-lg glass text-neon-cyan hover:text-neon-pink transition-colors"
                                >
                                  🔁 重试
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-stardust/40 mb-2.5">
                              {settings.deepseekApiKey
                                ? '点击下方按钮让 AI 讲解题型、解题思路与背景知识（仅生成一次，自动缓存）'
                                : '⚠️ 请先在「设置」中配置 DeepSeek API Key'}
                            </div>
                            {settings.deepseekApiKey && (
                              <button
                                onClick={() => {
                                  playButton()
                                  if (!q) return
                                  triggerAiInterpret(q, lastAnswerRef.current.userLetters, lastAnswerRef.current.correct)
                                }}
                                className="text-xs px-3 py-2 rounded-xl font-tech font-bold"
                                style={{
                                  background: 'rgba(255,46,136,0.15)',
                                  color: '#ff2e88',
                                  border: '1px solid rgba(255,46,136,0.45)',
                                }}
                              >
                                🤖 点击 AI 解读本题
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </WrongShake>
      </div>

      {/* 底部固定"下一题"按钮栏 */}
      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)', background: 'linear-gradient(to top, rgba(5,8,24,0.95), rgba(5,8,24,0.7) 70%, transparent)' }}
          >
            <div className="max-w-3xl mx-auto">
              <NeonButton onClick={next} className="w-full" variant={isCorrect ? 'primary' : 'secondary'}>
                {idx + 1 >= questions.length ? '完成关卡 🏁' : '下一题 →'}
              </NeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 特效层 */}
      <CoinBurst trigger={coinBurst} />
      <ComboFlash combo={combo} />
      <CritFlash trigger={critTrigger} />
      <CorrectGlow trigger={correctGlow} />
      <RankUpBanner trigger={rankUpTrigger} rankName={rankUpName} />
    </div>
  )
}

// 把 AI 返回的 ## 标题 + 内容简单渲染为分段（无需 markdown 引擎）
function renderAiText(text: string): JSX.Element {
  const parts = text.split(/(^## .+$)/m).filter(Boolean)
  const elements: JSX.Element[] = []
  parts.forEach((part, i) => {
    if (part.startsWith('## ')) {
      const title = part.slice(3).trim()
      const colors: Record<string, string> = {
        '题型': '#00f5ff',
        '解题思路': '#39ff14',
        '背景知识': '#ffd700',
        '易错提醒': '#ff2e88',
      }
      let color = '#00f5ff'
      for (const k of Object.keys(colors)) {
        if (title.includes(k)) { color = colors[k]; break }
      }
      elements.push(
        <div key={`t-${i}`} className="mt-2 first:mt-0 font-tech font-bold text-xs" style={{ color }}>
          {title}
        </div>,
      )
    } else {
      const content = part.trim()
      if (content) {
        elements.push(
          <p key={`p-${i}`} className="mt-1 text-sm text-stardust/85 leading-relaxed">
            {content}
          </p>,
        )
      }
    }
  })
  if (elements.length === 0) {
    return <>{text}</>
  }
  return <>{elements}</>
}

// 把 AI 返回的记忆口诀 4 段（## 谐音对照 / ## 场景动作 / ## 押韵口诀 / ## 关系公式）
// 分段渲染，每段带 emoji 图标和主题色
function renderMnemonicText(text: string): JSX.Element {
  const parts = text.split(/(^## .+$)/m).filter(Boolean)
  const elements: JSX.Element[] = []
  // 4 段主题色与图标映射
  const sectionMeta: Record<string, { icon: string; color: string }> = {
    '谐音': { icon: '🔤', color: '#ff2e88' },
    '场景': { icon: '🎬', color: '#00f5ff' },
    '押韵': { icon: '🎵', color: '#9d4edd' },
    '公式': { icon: '📐', color: '#ffd700' },
    '关系': { icon: '📐', color: '#ffd700' },
  }
  parts.forEach((part, i) => {
    if (part.startsWith('## ')) {
      const title = part.slice(3).trim()
      let meta = { icon: '✨', color: '#e0e0ff' }
      for (const k of Object.keys(sectionMeta)) {
        if (title.includes(k)) { meta = sectionMeta[k]; break }
      }
      elements.push(
        <div key={`t-${i}`} className="mt-3 first:mt-0 flex items-center gap-1.5 font-tech font-bold text-xs" style={{ color: meta.color }}>
          <span>{meta.icon}</span>
          <span>{title}</span>
        </div>,
      )
    } else {
      const content = part.trim()
      if (content) {
        elements.push(
          <p key={`p-${i}`} className="mt-1 text-sm text-stardust/85 leading-relaxed">
            {content}
          </p>,
        )
      }
    }
  })
  if (elements.length === 0) {
    return <>{text}</>
  }
  return <>{elements}</>
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
