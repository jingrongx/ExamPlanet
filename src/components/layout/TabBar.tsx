import { NavLink, useNavigate } from 'react-router-dom'
import { playButton } from '../../engine/audio'

const TABS = [
  { to: '/', label: '星球', icon: '🪐', end: true },
  { to: '/mistakes', label: '错题炉', icon: '🔥' },
  { to: '/memory', label: '记忆', icon: '🧠' },
  { to: '/base', label: '基地', icon: '🏠' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export function TabBar() {
  const navigate = useNavigate()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-2 pt-1 pointer-events-none" style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.5rem)' }}>
      <div className="max-w-md mx-auto glass-strong rounded-2xl px-1.5 py-1.5 flex items-center justify-between pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            onClick={() => playButton()}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-br from-neon-pink/20 to-neon-violet/20 border border-neon-pink/40'
                  : 'hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`text-xl transition-transform ${isActive ? 'scale-125' : ''}`}
                  style={isActive ? { filter: 'drop-shadow(0 0 6px #ff2e88)' } : {}}
                >
                  {t.icon}
                </span>
                <span
                  className={`text-[10px] font-tech tracking-wide ${
                    isActive ? 'text-neon-pink font-bold' : 'text-stardust/60'
                  }`}
                >
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
