import { useNavigate } from 'react-router-dom'
import { useGameStore, getRankByExp, getNextRank } from '../../store/useGameStore'
import { RankBadge, ProgressRing } from '../ui'
import { playButton } from '../../engine/audio'

// 顶部状态栏：金币 / 钻石 / 段位 / 经验 / 连签
export function Header() {
  const navigate = useNavigate()
  const { coins, diamonds, exp, streakDays } = useGameStore()
  const rank = getRankByExp(exp)
  const next = getNextRank(exp)

  const go = (path: string) => {
    playButton()
    navigate(path)
  }

  const expInRank = next ? exp - rank.minExp : exp - rank.minExp
  const expForNext = next ? next.minExp - rank.minExp : 100
  const pct = next ? Math.min(100, (expInRank / expForNext) * 100) : 100

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-3 pb-2 pointer-events-none" style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 pointer-events-auto">
        {/* 左：段位徽章 + 经验环 */}
        <button
          onClick={() => go('/base')}
          className="flex items-center gap-2 group"
          title="查看基地"
        >
          <ProgressRing progress={pct} size={44} stroke={3} color={rank.color}>
            <span className="text-lg">{rank.icon}</span>
          </ProgressRing>
          <div className="hidden sm:block text-left">
            <RankBadge rank={rank} exp={exp} mini />
            <div className="text-[10px] font-mono text-stardust/60 mt-0.5">
              {next ? `${expInRank}/${expForNext} XP` : 'MAX'}
            </div>
          </div>
        </button>

        {/* 中：连签 */}
        <button
          onClick={() => go('/base')}
          className="glass px-3 py-1.5 flex items-center gap-1.5 group hover:border-neon-gold/50 transition-colors"
          title="连续签到"
        >
          <span className="text-base">🔥</span>
          <span className="font-tech font-bold text-neon-gold text-sm">{streakDays}</span>
          <span className="text-[10px] text-stardust/60 hidden sm:inline">天连签</span>
        </button>

        {/* 右：金币 / 钻石 */}
        <div className="flex items-center gap-1.5">
          <div className="glass px-2.5 py-1.5 flex items-center gap-1">
            <span className="text-sm">🪙</span>
            <span className="font-tech font-bold text-neon-gold text-sm tabular-nums">{coins}</span>
          </div>
          <div className="glass px-2.5 py-1.5 flex items-center gap-1">
            <span className="text-sm">💎</span>
            <span className="font-tech font-bold text-neon-cyan text-sm tabular-nums">{diamonds}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
