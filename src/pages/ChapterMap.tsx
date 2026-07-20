import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { getLicense, getChapters, getQuestionsByChapter } from '../data/licenses'
import { useGameStore } from '../store/useGameStore'
import { GlassCard, NeonButton, ProgressRing } from '../components/ui'
import { playButton } from '../engine/audio'

export function ChapterMap() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { nodeProgress, passNode } = useGameStore()
  // 每个章节卡片的 ref，用于自动滚动定位
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([])

  const license = id ? getLicense(id as any) : null
  const chapters = id ? getChapters(id as any) : []

  // 解锁逻辑：第 1 章默认解锁；通过第 N 章解锁第 N+1 章
  function isUnlocked(idx: number): boolean {
    if (!license) return false
    if (idx === 0) return true
    const prevNode = `${license.id}-ch-${idx}`
    const prev = nodeProgress[prevNode]
    return prev === 'passed' || prev === 'perfect'
  }

  // 进入页面时自动滚动到最新已解锁但未通关的关卡
  useEffect(() => {
    if (!license || chapters.length === 0) return
    const firstUnplayed = chapters.findIndex((_, i) => {
      const unlocked = isUnlocked(i)
      const nodeId = `${license.id}-ch-${i + 1}`
      const state = nodeProgress[nodeId]
      const passed = state === 'passed' || state === 'perfect'
      return unlocked && !passed
    })
    const target = firstUnplayed >= 0 ? firstUnplayed : chapters.length - 1
    const el = chapterRefs.current[target]
    if (el) {
      // 用 'center' 让目标卡片居中显示，避免被顶部 sticky 卡片遮挡
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [id, nodeProgress])

  if (!id || !license) return null

  const goQuiz = (chapterId: string, idx: number) => {
    if (!isUnlocked(idx)) return
    playButton()
    navigate(`/license/${license.id}/quiz/${chapterId}`)
  }

  const goExam = () => {
    playButton()
    navigate(`/exam/${license.id}`)
  }

  const goSpace3D = () => {
    playButton()
    navigate(`/space3d/${license.id}`)
  }

  const passedCount = chapters.filter((_, i) => {
    const st = nodeProgress[`${license.id}-ch-${i + 1}`]
    return st === 'passed' || st === 'perfect'
  }).length

  const totalProgress = chapters.length > 0 ? Math.round((passedCount / chapters.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 顶部执照信息（sticky 固定，滚动时不动） */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong p-4 rounded-3xl relative overflow-hidden sticky z-20"
        style={{
          top: 'calc(var(--safe-top) + 4.5rem)',
          background: 'rgba(10, 14, 39, 0.92)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-40"
          style={{ background: license.planetColor }}
        />
        <div className="relative flex items-center gap-4">
          <button
            onClick={() => { playButton(); navigate('/') }}
            className="glass px-3 py-2 rounded-xl text-stardust/70 hover:text-neon-cyan"
          >
            ←
          </button>
          <div className="text-4xl" style={{ filter: `drop-shadow(0 0 12px ${license.color})` }}>{license.icon}</div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-black" style={{ color: license.color }}>{license.name}</h1>
            <p className="text-[11px] text-stardust/60">{license.fullName}</p>
          </div>
          <ProgressRing progress={totalProgress} size={56} stroke={4} color={license.color}>
            <span className="text-[10px] font-mono" style={{ color: license.color }}>{totalProgress}%</span>
          </ProgressRing>
        </div>
        <p className="relative text-xs text-stardust/70 mt-3 leading-relaxed">{license.fullDescription}</p>
        <div className="relative flex gap-2 mt-3">
          <NeonButton variant="secondary" onClick={goSpace3D} className="text-xs px-3 py-1.5">
            🛸 3D 模拟
          </NeonButton>
          <NeonButton variant="ghost" onClick={goExam} className="text-xs px-3 py-1.5">
            📝 模拟考试
          </NeonButton>
        </div>
      </motion.div>

      {/* 章节关卡路径 */}
      <div className="relative">
        {/* 连线 */}
        <div
          className="absolute left-7 top-0 bottom-0 w-0.5 opacity-30"
          style={{ background: `linear-gradient(180deg, ${license.color}, transparent)` }}
        />
        <div className="space-y-3">
          {chapters.map((ch, i) => {
            const nodeId = `${license.id}-ch-${i + 1}`
            const state = nodeProgress[nodeId]
            const unlocked = isUnlocked(i)
            const passed = state === 'passed' || state === 'perfect'
            const perfect = state === 'perfect'
            const qs = getQuestionsByChapter(ch.id)
            const isElite = i === Math.floor(chapters.length / 2)
            const isBoss = i === chapters.length - 1

            return (
              <motion.div
                key={ch.id}
                ref={(el) => { chapterRefs.current[i] = el }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative pl-16"
              >
                {/* 节点圆点 */}
                <button
                  onClick={() => goQuiz(ch.id, i)}
                  disabled={!unlocked}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                      unlocked ? 'hover:scale-110' : 'opacity-40'
                    }`}
                    style={{
                      background: passed ? `${license.color}30` : unlocked ? 'rgba(255,255,255,0.08)' : 'rgba(10,14,39,0.6)',
                      border: `2px solid ${passed ? license.color : unlocked ? `${license.color}80` : '#ffffff20'}`,
                      boxShadow: passed ? `0 0 20px ${license.color}80` : unlocked ? `0 0 8px ${license.color}40` : 'none',
                    }}
                  >
                    {perfect ? '⭐' : passed ? '✓' : isBoss ? '👑' : isElite ? '⚔️' : unlocked ? '🚀' : '🔒'}
                  </div>
                </button>

                {/* 章节卡片 */}
                <GlassCard
                  onClick={() => goQuiz(ch.id, i)}
                  glow={unlocked && !passed}
                  className={`p-3 ${!unlocked ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-stardust/40">CH.{i + 1}</span>
                        {isBoss && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-red/20 text-neon-red font-bold">BOSS</span>}
                        {isElite && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-gold/20 text-neon-gold font-bold">精英</span>}
                        {perfect && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-green/20 text-neon-green font-bold">完美</span>}
                      </div>
                      <div className="font-tech font-bold text-sm mt-0.5 truncate" style={{ color: unlocked ? license.color : '#ffffff60' }}>
                        {ch.name}
                      </div>
                      <div className="text-[11px] text-stardust/50 mt-0.5">{qs.length} 题 · {difficultyLabel(qs)}</div>
                    </div>
                    {unlocked && (
                      <div className="text-stardust/40 text-xl">›</div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function difficultyLabel(qs: { difficulty: number }[]) {
  if (qs.length === 0) return ''
  const avg = qs.reduce((s, q) => s + q.difficulty, 0) / qs.length
  if (avg < 1.5) return '入门'
  if (avg < 2.5) return '进阶'
  return '挑战'
}
