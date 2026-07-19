import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { getLicense } from '../data/licenses'
import { GlassCard, NeonButton } from '../components/ui'
import { playButton, speak, stopSpeak } from '../engine/audio'

interface ResultState {
  correct: number
  total: number
  answers: Record<string, string>
  questions: { id: string; category: string; answer: string; question: string; options: string[]; explanation: string }[]
}

export function ExamResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ResultState | null
  const [showReview, setShowReview] = useState(false)

  const license = id ? getLicense(id as any) : null

  // 按章节统计正确率（雷达图数据）
  const radarData = useMemo(() => {
    if (!state) return []
    const byCat: Record<string, { correct: number; total: number }> = {}
    for (const q of state.questions) {
      if (!byCat[q.category]) byCat[q.category] = { correct: 0, total: 0 }
      byCat[q.category].total++
      if (state.answers[q.id] === q.answer) byCat[q.category].correct++
    }
    return Object.entries(byCat).map(([cat, v]) => ({
      category: cat.length > 6 ? cat.slice(0, 6) + '…' : cat,
      fullCat: cat,
      rate: Math.round((v.correct / v.total) * 100),
    }))
  }, [state])

  if (!state || !license) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-stardust/60 mb-3">无考试数据</p>
          <NeonButton onClick={() => navigate('/')}>返回大厅</NeonButton>
        </div>
      </div>
    )
  }

  const pct = Math.round((state.correct / state.total) * 100)
  const passed = pct >= 60
  const wrongQuestions = state.questions.filter((q) => state.answers[q.id] !== q.answer)

  return (
    <div className="min-h-screen px-3 py-6 max-w-3xl mx-auto">
      {/* 总分卡片 */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-strong p-6 rounded-3xl text-center mb-4 relative overflow-hidden"
      >
        <div className={`absolute inset-0 ${passed ? 'bg-gradient-to-br from-neon-green/10 to-neon-cyan/10' : 'bg-gradient-to-br from-neon-red/10 to-neon-pink/10'}`} />
        <div className="relative">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-6xl mb-2"
          >
            {pct >= 80 ? '🏆' : passed ? '🎉' : '💪'}
          </motion.div>
          <h1 className="font-display text-2xl font-black mb-1" style={{ color: passed ? '#39ff14' : '#ff3860' }}>
            {pct >= 80 ? '优秀！' : passed ? '通过！' : '未通过'}
          </h1>
          <div className="font-display text-5xl font-black my-2" style={{ color: passed ? '#39ff14' : '#ff3860' }}>
            {pct}<span className="text-2xl">分</span>
          </div>
          <p className="text-sm text-stardust/70">
            {state.correct} / {state.total} 正确 · {license.name}
          </p>
          <div className="flex justify-center gap-2 mt-3 text-[11px]">
            <span className="px-2 py-1 rounded-full glass text-neon-green">✓ {state.correct}</span>
            <span className="px-2 py-1 rounded-full glass text-neon-red">✗ {state.total - state.correct}</span>
          </div>
        </div>
      </motion.div>

      {/* 雷达图：各章节掌握度 */}
      {radarData.length > 1 && (
        <GlassCard className="p-4 mb-4">
          <h3 className="font-display font-bold text-sm neon-text-cyan mb-3 text-center">章节掌握雷达</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#ffffff20" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#e0e0ff', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#ffffff60', fontSize: 9 }} stroke="#ffffff20" />
                <Radar
                  name="掌握率"
                  dataKey="rate"
                  stroke="#00f5ff"
                  fill="#00f5ff"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <NeonButton variant="ghost" onClick={() => { playButton(); setShowReview(!showReview) }} className="flex-1 text-xs">
          {showReview ? '隐藏解析' : `查看错题 (${wrongQuestions.length})`}
        </NeonButton>
        <NeonButton variant="secondary" onClick={() => { playButton(); navigate(`/exam/${license.id}`) }} className="flex-1 text-xs">
          再考一次
        </NeonButton>
        <NeonButton variant="primary" onClick={() => { playButton(); navigate(`/license/${license.id}`) }} className="flex-1 text-xs">
          返回地图
        </NeonButton>
      </div>

      {/* 错题解析 */}
      {showReview && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <h3 className="font-display font-bold text-sm neon-text-red">错题解析 ({wrongQuestions.length})</h3>
          {wrongQuestions.length === 0 && (
            <GlassCard className="p-6 text-center">
              <div className="text-3xl mb-1">🌟</div>
              <p className="text-sm text-stardust/70">全部答对，无错题！</p>
            </GlassCard>
          )}
          {wrongQuestions.map((q, i) => (
            <GlassCard key={q.id} className="p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-red/20 text-neon-red font-bold">错 {i + 1}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded glass text-stardust/60">{q.category}</span>
              </div>
              <p className="text-sm text-stardust mb-2 leading-relaxed">{q.question}</p>
              <div className="space-y-1.5 mb-2">
                {q.options.map((opt) => {
                  const isAns = opt === q.answer
                  const isPicked = state.answers[q.id] === opt
                  return (
                    <div
                      key={opt}
                      className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isAns ? 'bg-neon-green/15 text-neon-green' : isPicked ? 'bg-neon-red/15 text-neon-red' : 'glass text-stardust/60'
                      }`}
                    >
                      <span>{isAns ? '✓' : isPicked ? '✗' : '○'}</span>
                      <span>{opt}</span>
                    </div>
                  )
                })}
              </div>
              <div className="glass p-3 rounded-xl" style={{ borderLeft: '2px solid #00f5ff' }}>
                <p className="text-xs text-stardust/80 leading-relaxed">{q.explanation}</p>
              </div>
              <button
                onClick={() => speak(q.question + ' 答案 ' + q.answer + '。' + q.explanation)}
                className="mt-2 text-[11px] text-neon-cyan hover:text-neon-pink"
              >
                🔊 朗读解析
              </button>
            </GlassCard>
          ))}
        </motion.div>
      )}
    </div>
  )
}
