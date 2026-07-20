import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { streamMnemonic } from '../../services/mnemonic'
import { useGameStore } from '../../store/useGameStore'
import { playButton } from '../../engine/audio'
import type { Question } from '../../types'

function isMultiChoice(q: Question): boolean {
  return q.type === 'multi' || q.answer.toUpperCase().replace(/[^A-D]/g, '').length > 1
}

interface MnemonicCardProps {
  question: Question
  licenseName?: string
}

/**
 * AI 记忆口诀卡片（答题页 + 记忆工坊共用）
 * - 共用全局 mnemonicCache，一边生成另一边直接显示
 * - 点击触发按钮生成，不自动调用
 * - 4 段渲染：谐音/场景/押韵/公式，带 emoji 和主题色
 * - 支持重新生成、重试
 *
 * 父组件切换题目时请传 key={question.id} 强制重新挂载，保证状态干净。
 */
export function MnemonicCard({ question, licenseName }: MnemonicCardProps) {
  const { settings, mnemonicCache, setMnemonic } = useGameStore()
  const cached = mnemonicCache[question.id] || ''
  const [text, setText] = useState<string>(cached)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  const trigger = useCallback(async (force: boolean) => {
    if (!settings.deepseekApiKey) {
      setText('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再生成 AI 口诀。')
      return
    }
    if (!force) {
      const c = mnemonicCache[question.id] || ''
      if (c) {
        setText(c)
        return
      }
    }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setText('')
    let firstChunk = true
    let accumulated = ''
    await streamMnemonic(
      {
        question: question.question,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        type: isMultiChoice(question) ? 'multi' : 'single',
        licenseName,
      },
      settings.deepseekApiKey,
      (chunk) => {
        if (firstChunk) { setLoading(false); firstChunk = false }
        accumulated += chunk
        setText(accumulated)
      },
      controller.signal,
    )
    if (firstChunk) setLoading(false)
    if (accumulated && !accumulated.startsWith('⚠️')) {
      setMnemonic(question.id, accumulated)
    }
  }, [settings.deepseekApiKey, licenseName, question, mnemonicCache, setMnemonic])

  const hasKey = !!settings.deepseekApiKey
  const isError = text.startsWith('⚠️')

  return (
    <div className="glass p-4 rounded-2xl" style={{ borderLeft: '2px solid #ffd700' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <span className="font-tech font-bold text-sm neon-text-gold">记忆口诀 · AI</span>
          {text && !loading && !isError && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-gold/15 text-neon-gold/80">
              {cached ? '已缓存' : '已生成'}
            </span>
          )}
        </div>
        {loading && (
          <span className="text-[10px] text-stardust/50 animate-pulse">编口中…</span>
        )}
      </div>

      {/* 状态分支：加载中 / 有文本 / 空闲 */}
      {loading && !text ? (
        <div className="flex items-center gap-1.5 text-xs text-stardust/50">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            正在为你编口诀…
          </motion.span>
        </div>
      ) : text ? (
        <>
          <div className="text-sm text-stardust/85 leading-relaxed whitespace-pre-wrap break-words">
            {renderMnemonicText(text)}
          </div>
          {/* 重新生成按钮 */}
          {!loading && !isError && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { playButton(); trigger(true) }}
                className="text-[11px] px-3 py-1.5 rounded-lg glass text-neon-gold hover:text-neon-cyan transition-colors"
              >
                🔄 重新生成
              </button>
            </div>
          )}
          {/* 错误提示重试 */}
          {!loading && isError && (
            <div className="mt-3">
              <button
                onClick={() => { playButton(); trigger(true) }}
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
            {hasKey
              ? '点击下方按钮让 AI 为本题编 4 段口诀（谐音 / 场景 / 押韵 / 公式，仅生成一次，自动缓存，答题页与记忆工坊共用）'
              : '⚠️ 请先在「设置」中配置 DeepSeek API Key'}
          </div>
          {hasKey && (
            <button
              onClick={() => { playButton(); trigger(false) }}
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
