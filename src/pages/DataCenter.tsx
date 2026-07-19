import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useGameStore, getRankByExp } from '../store/useGameStore'
import { LICENSES, getQuestion } from '../data/licenses'
import { GlassCard, NeonButton } from '../components/ui'
import { playButton } from '../engine/audio'

export function DataCenter() {
  const navigate = useNavigate()
  const { answerLogs, mistakes, exp, totalAnswered, totalCorrect, maxCombo, studyDays, coins, diamonds } = useGameStore()
  const rank = getRankByExp(exp)

  // 最近 14 天答题趋势
  const trendData = useMemo(() => {
    const days: { date: string; label: string; correct: number; wrong: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const dayLogs = answerLogs.filter((l) => l.answeredAt >= d.setHours(0, 0, 0, 0) && l.answeredAt < d.setHours(24, 0, 0, 0))
      days.push({
        date: key,
        label: key.slice(5),
        correct: dayLogs.filter((l) => l.isCorrect).length,
        wrong: dayLogs.filter((l) => !l.isCorrect).length,
      })
    }
    return days
  }, [answerLogs])

  // 各执照正确率
  const licenseData = useMemo(() => {
    return LICENSES.map((l) => {
      const licLogs = answerLogs.filter((log) => {
        const q = getQuestion(log.questionId)
        return q && log.questionId.startsWith(l.id.toUpperCase()) || (q && log.questionId.toLowerCase().startsWith(l.id))
      })
      const correct = licLogs.filter((l) => l.isCorrect).length
      const total = licLogs.length
      return {
        name: l.name,
        icon: l.icon,
        color: l.color,
        total,
        correct,
        rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      }
    })
  }, [answerLogs])

  // 错题等级分布
  const mistakeLevels = useMemo(() => {
    const all = Object.values(mistakes).filter((m) => !m.mastered)
    return [
      { level: 'Lv1', count: all.filter((m) => m.level === 1).length, color: '#00f5ff' },
      { level: 'Lv2', count: all.filter((m) => m.level === 2).length, color: '#ffd700' },
      { level: 'Lv3', count: all.filter((m) => m.level === 3).length, color: '#ff3860' },
    ]
  }, [mistakes])

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-black neon-text-cyan">数据中心</h1>
          <p className="text-[11px] text-stardust/50 font-mono mt-1">DATA CENTER · 学习分析</p>
        </div>
        <NeonButton variant="ghost" onClick={() => { playButton(); navigate('/base') }} className="text-xs">← 基地</NeonButton>
      </motion.div>

      {/* 总览数字 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="总答题数" value={totalAnswered} color="#00f5ff" icon="📝" />
        <StatCard label="正确率" value={`${accuracy}%`} color="#39ff14" icon="🎯" />
        <StatCard label="最高连击" value={maxCombo} color="#ffd700" icon="⚡" />
        <StatCard label="学习天数" value={studyDays.length} color="#9d4edd" icon="📅" />
      </div>

      {/* 14 天答题趋势 */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm neon-text-cyan mb-3">📈 近 14 天答题趋势</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gCorrect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#39ff14" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#39ff14" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWrong" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3860" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff3860" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" />
              <XAxis dataKey="label" tick={{ fill: '#ffffff60', fontSize: 9 }} />
              <YAxis tick={{ fill: '#ffffff60', fontSize: 9 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(10,14,39,0.95)', border: '1px solid #00f5ff50', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#00f5ff' }}
              />
              <Area type="monotone" dataKey="correct" name="答对" stroke="#39ff14" strokeWidth={2} fill="url(#gCorrect)" />
              <Area type="monotone" dataKey="wrong" name="答错" stroke="#ff3860" strokeWidth={2} fill="url(#gWrong)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* 各执照掌握度 */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm neon-text-pink mb-3">🪐 各执照答题分布</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={licenseData}>
              <CartesianGrid stroke="#ffffff10" />
              <XAxis dataKey="name" tick={{ fill: '#ffffff80', fontSize: 10 }} />
              <YAxis tick={{ fill: '#ffffff60', fontSize: 9 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(10,14,39,0.95)', border: '1px solid #ff2e8850', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#ff2e88' }}
              />
              <Bar dataKey="correct" name="答对" fill="#39ff14" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total" name="总题数" fill="#ffffff20" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {licenseData.map((l) => (
            <div key={l.name} className="glass p-2 rounded-lg text-center">
              <div className="text-base">{l.icon}</div>
              <div className="text-[10px] text-stardust/60">{l.name}</div>
              <div className="text-xs font-bold" style={{ color: l.color }}>{l.rate}%</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* 错题等级分布 */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm neon-text-gold mb-3">🔥 错题熔炉分布</h3>
        <div className="space-y-2">
          {mistakeLevels.map((m) => (
            <div key={m.level} className="flex items-center gap-3">
              <span className="text-xs font-mono w-8" style={{ color: m.color }}>{m.level}</span>
              <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, m.count * 10)}%` }}
                  className="h-full rounded-lg flex items-center justify-end pr-2"
                  style={{ background: `${m.color}40`, boxShadow: `0 0 10px ${m.color}40` }}
                >
                  <span className="text-[10px] font-bold" style={{ color: m.color }}>{m.count}</span>
                </motion.div>
              </div>
              <span className="text-[10px] text-stardust/50 w-12 text-right">
                {m.level === 'Lv1' ? '新错' : m.level === 'Lv2' ? '中错' : '顽固'}
              </span>
            </div>
          ))}
        </div>
        {mistakeLevels.every((m) => m.count === 0) && (
          <p className="text-center text-xs text-stardust/50 py-2">暂无错题，继续保持！</p>
        )}
      </GlassCard>

      {/* 学习日历热力图（最近 30 天） */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm neon-text-violet mb-3">📅 学习日历（30天）</h3>
        <CalendarHeatmap studyDays={studyDays} answerLogs={answerLogs} />
      </GlassCard>

      {/* 资产 */}
      <GlassCard className="p-4 flex items-center justify-around">
        <div className="text-center">
          <div className="font-display font-black text-xl text-neon-gold">{coins}🪙</div>
          <div className="text-[10px] text-stardust/60">金币</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="text-center">
          <div className="font-display font-black text-xl text-neon-cyan">{diamonds}💎</div>
          <div className="text-[10px] text-stardust/60">钻石</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="text-center">
          <div className="font-display font-black text-xl" style={{ color: rank.color }}>{exp}</div>
          <div className="text-[10px] text-stardust/60">经验</div>
        </div>
      </GlassCard>
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <GlassCard className="p-3 text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="font-display font-black text-xl" style={{ color }}>{value}</div>
      <div className="text-[10px] text-stardust/60">{label}</div>
    </GlassCard>
  )
}

function CalendarHeatmap({ studyDays, answerLogs }: { studyDays: string[]; answerLogs: { answeredAt: number }[] }) {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dayStart = new Date(key).setHours(0, 0, 0, 0)
    const count = answerLogs.filter((l) => l.answeredAt >= dayStart && l.answeredAt < dayStart + 86400000).length
    const studied = studyDays.includes(key)
    days.push({ key, count, studied })
  }
  const intensity = (count: number) => {
    if (count === 0) return 'rgba(255,255,255,0.05)'
    if (count < 5) return 'rgba(0,245,255,0.3)'
    if (count < 15) return 'rgba(0,245,255,0.55)'
    if (count < 30) return 'rgba(0,245,255,0.8)'
    return 'rgba(57,255,20,0.9)'
  }
  return (
    <div className="grid grid-cols-10 gap-1">
      {days.map((d) => (
        <div
          key={d.key}
          title={`${d.key} · ${d.count}题`}
          className="aspect-square rounded-sm"
          style={{
            background: intensity(d.count),
            boxShadow: d.count > 0 ? `0 0 4px ${intensity(d.count)}` : 'none',
          }}
        />
      ))}
    </div>
  )
}
