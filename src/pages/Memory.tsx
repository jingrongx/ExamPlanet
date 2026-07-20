import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo, useCallback } from 'react'
import { LICENSES, getQuestionsByLicense } from '../data/licenses'
import { getMnemonic } from '../engine/mnemonic'
import { MnemonicCard } from '../components/ui/MnemonicCard'
import { GlassCard, NeonButton, useToast } from '../components/ui'
import { playButton, playCorrect, speak, stopSpeak } from '../engine/audio'
import type { LicenseId, Question } from '../types'

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

// 口诀浏览模式：点击题目展开显示 MnemonicCard（与答题页共用缓存）
function BrowseMode({ questions, licenseColor, licenseName }: { questions: Question[]; licenseColor: string; licenseName: string }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (q: Question) => {
    playButton()
    if (expanded === q.id) {
      setExpanded(null)
      return
    }
    setExpanded(q.id)
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-stardust/50 px-1">点击题目展开 AI 记忆口诀卡片（与答题页共用同一份缓存）</p>
      {questions.map((q, i) => {
        const builtin = getMnemonic(q.id)
        const isOpen = expanded === q.id
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
                  {/* AI 口诀卡片：与答题页共用同一组件，缓存打通 */}
                  <MnemonicCard key={q.id} question={q} licenseName={licenseName} />
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
