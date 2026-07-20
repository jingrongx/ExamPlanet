import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo, useCallback, useRef } from 'react'
import { LICENSES, getQuestionsByLicense } from '../data/licenses'
import { getMnemonic } from '../engine/mnemonic'
import { streamMnemonic } from '../services/mnemonic'
import { useGameStore } from '../store/useGameStore'
import { GlassCard, NeonButton, useToast } from '../components/ui'
import { playButton, playCorrect, speak, stopSpeak } from '../engine/audio'
import type { LicenseId, Question } from '../types'

function isMultiChoice(q: Question): boolean {
  return q.type === 'multi' || q.answer.toUpperCase().replace(/[^A-D]/g, '').length > 1
}

function cleanOption(opt: string): string {
  return opt.replace(/^[A-D][.、)]\s*/, '')
}

export function Memory() {
  const navigate = useNavigate()
  const toast = useToast()
  const [licenseId, setLicenseId] = useState<LicenseId>('uav')
  const [mode, setMode] = useState<'browse' | 'flashcard'>('browse')

  const license = LICENSES.find((l) => l.id === licenseId)!
  const questions = useMemo(() => getQuestionsByLicense(licenseId), [licenseId])

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
        <h1 className="font-display text-2xl font-black neon-text-gold">记忆工坊</h1>
        <p className="text-[11px] text-stardust/50 font-mono mt-1">MEMORY WORKSHOP · 闪卡 · 口诀 · 联想</p>
      </motion.div>

      {/* 执照选择 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {LICENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => { playButton(); setLicenseId(l.id); setMode('browse') }}
            className={`flex-shrink-0 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              l.id === licenseId ? 'glass-strong border' : 'glass'
            }`}
            style={l.id === licenseId ? { borderColor: l.color, color: l.color } : {}}
          >
            <span className="text-base">{l.icon}</span>
            <span className="text-xs font-tech">{l.name}</span>
          </button>
        ))}
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2">
        <NeonButton variant={mode === 'browse' ? 'primary' : 'ghost'} onClick={() => { playButton(); setMode('browse') }} className="flex-1 text-xs">
          📚 口诀浏览
        </NeonButton>
        <NeonButton variant={mode === 'flashcard' ? 'primary' : 'ghost'} onClick={() => { playButton(); setMode('flashcard') }} className="flex-1 text-xs">
          🃏 闪卡训练
        </NeonButton>
      </div>

      {mode === 'browse' ? (
        <BrowseMode questions={questions} licenseColor={license.color} licenseName={license.name} />
      ) : (
        <FlashcardMode questions={questions} licenseColor={license.color} />
      )}
    </div>
  )
}

// 口诀浏览模式：点击题目触发 AI 生成口诀（4 段：谐音/场景/押韵/公式），自动缓存
function BrowseMode({ questions, licenseColor, licenseName }: { questions: Question[]; licenseColor: string; licenseName: string }) {
  const toast = useToast()
  const { settings, mnemonicCache, setMnemonic } = useGameStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  // 当前展开题目的 AI 口诀文本（实时打字机累加）
  const [activeText, setActiveText] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const triggerGen = useCallback(async (q: Question, force: boolean) => {
    if (!settings.deepseekApiKey) {
      setActiveText('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再生成 AI 口诀。')
      return
    }
    if (!force) {
      const cached = mnemonicCache[q.id]
      if (cached) {
        setActiveText(cached)
        return
      }
    }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setActiveText('')
    let firstChunk = true
    let accumulated = ''
    await streamMnemonic(
      {
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        type: isMultiChoice(q) ? 'multi' : 'single',
        licenseName,
      },
      settings.deepseekApiKey,
      (chunk) => {
        if (firstChunk) { setLoading(false); firstChunk = false }
        accumulated += chunk
        setActiveText(accumulated)
      },
      controller.signal,
    )
    if (firstChunk) setLoading(false)
    if (accumulated && !accumulated.startsWith('⚠️')) {
      setMnemonic(q.id, accumulated)
    }
  }, [settings.deepseekApiKey, licenseName, mnemonicCache, setMnemonic])

  const toggle = (q: Question) => {
    playButton()
    if (expanded === q.id) {
      setExpanded(null)
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
      setActiveText('')
      setLoading(false)
      return
    }
    // 切换题目：先取消上一个，再展示新题目（有缓存直接展示缓存）
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setExpanded(q.id)
    setLoading(false)
    const cached = mnemonicCache[q.id] || ''
    setActiveText(cached)
    // 若无缓存且已配置 key，自动触发生成
    if (!cached && settings.deepseekApiKey) {
      triggerGen(q, false)
    } else if (!cached && !settings.deepseekApiKey) {
      setActiveText('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再生成 AI 口诀。')
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-stardust/50 px-1">点击题目展开，AI 自动生成 4 段记忆口诀（谐音/场景/押韵/公式），生成后缓存</p>
      {questions.map((q, i) => {
        const builtin = getMnemonic(q.id)
        const isOpen = expanded === q.id
        const cached = !!mnemonicCache[q.id]
        return (
          <GlassCard key={q.id} className="overflow-hidden">
            <button onClick={() => toggle(q)} className="w-full p-3 text-left flex items-start gap-3">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold"
                style={{ background: `${licenseColor}20`, color: licenseColor }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stardust/90 line-clamp-2">{q.question}</p>
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                  {builtin && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-gold/20 text-neon-gold">⭐ 内置</span>
                  )}
                  {cached && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-cyan/15 text-neon-cyan/80">🧠 已缓存</span>
                  )}
                </div>
              </div>
              <span className={`text-stardust/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3 space-y-2"
                >
                  {builtin && (
                    <div className="glass p-3 rounded-xl" style={{ borderLeft: '2px solid #ffd700' }}>
                      <div className="text-[10px] font-tech font-bold text-neon-gold mb-1">⭐ 经典口诀</div>
                      <p className="text-xs text-stardust/90 leading-relaxed">{builtin}</p>
                    </div>
                  )}
                  <div className="glass p-3 rounded-xl" style={{ borderLeft: '2px solid #00f5ff' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-tech font-bold text-neon-cyan">🧠 AI 记忆口诀</span>
                      {loading && (
                        <span className="text-[10px] text-stardust/50 animate-pulse">编口中…</span>
                      )}
                      {!loading && activeText && !activeText.startsWith('⚠️') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); playButton(); triggerGen(q, true) }}
                          className="text-[10px] text-neon-gold hover:text-neon-cyan"
                        >
                          🔄 重新生成
                        </button>
                      )}
                      {!loading && activeText.startsWith('⚠️') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); playButton(); triggerGen(q, true) }}
                          className="text-[10px] text-neon-cyan hover:text-neon-gold"
                        >
                          🔁 重试
                        </button>
                      )}
                    </div>
                    {loading && !activeText ? (
                      <div className="text-[11px] text-stardust/50 animate-pulse">正在为你编 4 段口诀…</div>
                    ) : activeText ? (
                      <div className="text-xs text-stardust/90 leading-relaxed whitespace-pre-wrap break-words">
                        {renderMnemonicText(activeText)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stardust/40">
                        {settings.deepseekApiKey ? '正在准备生成…' : '请先在「设置」中配置 DeepSeek API Key'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => speak(q.question + '。正确答案是 ' + cleanOption(q.options[q.answer.charCodeAt(0) - 65] || q.answer))}
                      className="text-[11px] px-2 py-1 rounded-lg glass text-neon-cyan hover:text-neon-pink"
                    >
                      🔊 朗读
                    </button>
                    <button
                      onClick={() => { stopSpeak(); toast('已停止', 'info') }}
                      className="text-[11px] px-2 py-1 rounded-lg glass text-stardust/60"
                    >
                      ⏹ 停止
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        )
      })}
    </div>
  )
}

// 闪卡训练模式
function FlashcardMode({ questions, licenseColor }: { questions: Question[]; licenseColor: string }) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())

  const q = questions[idx]
  const next = useCallback((got: boolean) => {
    if (got) {
      playCorrect()
      setKnown((s) => new Set(s).add(q.id))
    }
    setFlipped(false)
    setTimeout(() => {
      setIdx((i) => (i + 1) % questions.length)
    }, 200)
  }, [q])

  if (!q) return null
  const builtin = getMnemonic(q.id)
  // 把答案字母（如 "B" 或多选 "ABC"）转换为完整选项文本（不带字母前缀）
  const correctLetters = q.answer.toUpperCase().replace(/[^A-D]/g, '').split('')
  const correctTexts = correctLetters.map((l) => {
    const i = l.charCodeAt(0) - 65
    const opt = q.options[i]
    return opt ? cleanOption(opt) : l
  })
  const isMulti = correctLetters.length > 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-stardust/60">{idx + 1} / {questions.length}</span>
        <span className="font-mono text-neon-green">已掌握 {known.size}</span>
      </div>

      {/* 闪卡 */}
      <div className="perspective">
        <motion.div
          className="relative w-full h-80 cursor-pointer"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => { playButton(); setFlipped((f) => !f) }}
        >
          {/* 正面：题目 */}
          <div
            className="absolute inset-0 glass-strong rounded-3xl p-6 flex flex-col items-center justify-center text-center"
            style={{ backfaceVisibility: 'hidden', border: `1px solid ${licenseColor}50` }}
          >
            <div className="text-[10px] font-mono text-stardust/40 mb-3">题目 · 点击翻面</div>
            <p className="text-base text-stardust leading-relaxed">{q.question}</p>
            <div className="absolute bottom-4 text-[10px] text-stardust/40">难度 {'⭐'.repeat(q.difficulty)}</div>
          </div>
          {/* 背面：答案 + 解析（只显示选项文本，不显示字母前缀）*/}
          <div
            className="absolute inset-0 glass-strong rounded-3xl p-6 flex flex-col items-center justify-center text-center overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              border: `1px solid #39ff1450`,
            }}
          >
            <div className="text-[10px] font-mono text-neon-green mb-2">
              ✓ 正确答案{isMulti ? `（多选）` : ''}
            </div>
            <p className="text-base font-display font-bold text-neon-green mb-3 leading-relaxed">
              {correctTexts.join('  ｜  ')}
            </p>
            <p className="text-xs text-stardust/80 leading-relaxed mb-2">{q.explanation}</p>
            {builtin && (
              <p className="text-[11px] text-neon-gold leading-relaxed mt-1">🧠 {builtin}</p>
            )}
          </div>
        </motion.div>
      </div>

      <p className="text-center text-[11px] text-stardust/40">点击卡片翻转 · 选择是否掌握</p>

      {/* 评价按钮 */}
      <div className="flex gap-2">
        <NeonButton variant="danger" onClick={() => next(false)} className="flex-1 text-xs">
          😵 没掌握
        </NeonButton>
        <NeonButton variant="secondary" onClick={() => next(true)} className="flex-1 text-xs">
          😎 掌握了
        </NeonButton>
      </div>
    </div>
  )
}

// 把 AI 返回的记忆口诀 4 段（## 谐音对照 / ## 场景动作 / ## 押韵口诀 / ## 关系公式）
// 分段渲染，每段带 emoji 图标和主题色
function renderMnemonicText(text: string): JSX.Element {
  const parts = text.split(/(^## .+$)/m).filter(Boolean)
  const elements: JSX.Element[] = []
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
          <p key={`p-${i}`} className="mt-1 text-sm text-stardust/90 leading-relaxed">
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
