import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import { GlassCard, NeonButton, Modal, useToast } from '../components/ui'
import { playButton, startAmbient, stopAmbient, speak, stopSpeak, setAudioEnabled, setAmbientEnabled, setSfxVolume } from '../engine/audio'

export function Settings() {
  const navigate = useNavigate()
  const toast = useToast()
  const { settings, updateSettings, exportData, importData, resetAll, userId, nickname } = useGameStore()
  const [showReset, setShowReset] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const toggle = (key: keyof typeof settings, value: boolean) => {
    playButton()
    updateSettings({ [key]: value })
    if (key === 'soundEnabled') setAudioEnabled(value)
    if (key === 'ambientEnabled') {
      setAmbientEnabled(value)
      if (value) startAmbient()
      else stopAmbient()
    }
  }

  const handleExport = () => {
    playButton()
    const data = exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cert-planet-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('存档已导出', 'success')
  }

  const handleImport = () => {
    const ok = importData(importText)
    if (ok) {
      toast('存档已导入', 'success')
      setShowImport(false)
      setImportText('')
    } else {
      toast('导入失败：数据格式错误', 'error')
    }
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setImportText(text)
      setShowImport(true)
    }
    reader.readAsText(file)
  }

  const handleReset = () => {
    resetAll()
    playButton()
    toast('已重置所有数据', 'info')
    setShowReset(false)
    setTimeout(() => navigate('/'), 300)
  }

  const testTTS = () => {
    if (settings.ttsEnabled) {
      speak('考证星球，祝你考试顺利通过')
      toast('TTS 测试中...', 'info')
    } else {
      toast('请先开启语音朗读', 'info')
    }
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
        <h1 className="font-display text-2xl font-black neon-text-cyan">设置</h1>
        <p className="text-[11px] text-stardust/50 font-mono mt-1">SETTINGS · 系统配置</p>
      </motion.div>

      {/* 声音设置 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-pink mb-2 px-1">🔊 声音</h3>
        <GlassCard className="divide-y divide-white/5">
          <ToggleRow
            label="音效"
            desc="答题、金币、升级等音效"
            value={settings.soundEnabled}
            onChange={(v) => toggle('soundEnabled', v)}
          />
          <ToggleRow
            label="环境音乐"
            desc="太空低频星云背景音"
            value={settings.ambientEnabled}
            onChange={(v) => toggle('ambientEnabled', v)}
          />
          <ToggleRow
            label="语音朗读 (TTS)"
            desc="朗读题目和解析（需浏览器支持）"
            value={settings.ttsEnabled}
            onChange={(v) => { toggle('ttsEnabled', v); if (v) speak('已开启语音朗读') }}
          />
          <div className="p-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-stardust/80">音效音量</span>
              <span className="text-xs font-mono text-neon-cyan">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                updateSettings({ sfxVolume: v })
                setSfxVolume(v)
              }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(90deg, #00f5ff ${settings.sfxVolume * 100}%, rgba(255,255,255,0.1) ${settings.sfxVolume * 100}%)`,
              }}
            />
          </div>
          <div className="p-4 flex gap-2">
            <NeonButton variant="ghost" onClick={testTTS} className="flex-1 text-xs">🔊 测试 TTS</NeonButton>
            <NeonButton variant="ghost" onClick={() => stopSpeak()} className="flex-1 text-xs">⏹ 停止朗读</NeonButton>
          </div>
        </GlassCard>
      </section>

      {/* 数据管理 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-gold mb-2 px-1">💾 数据管理</h3>
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-stardust/80">用户 ID</div>
              <div className="text-[10px] text-stardust/40 font-mono">{userId}</div>
            </div>
            <span className="text-[10px] text-stardust/50">{nickname}</span>
          </div>
          <div className="flex gap-2">
            <NeonButton variant="secondary" onClick={handleExport} className="flex-1 text-xs">
              📤 导出存档
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => fileRef.current?.click()} className="flex-1 text-xs">
              📥 导入存档
            </NeonButton>
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileImport} className="hidden" />
          </div>
          <div className="text-[10px] text-stardust/40 leading-relaxed">
            💡 数据存储在浏览器本地，清除浏览器数据会丢失进度，请定期导出备份。
          </div>
        </GlassCard>
      </section>

      {/* 危险区 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-red mb-2 px-1">⚠️ 危险操作</h3>
        <GlassCard className="p-4 border-neon-red/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-stardust/80">重置所有数据</div>
              <div className="text-[10px] text-stardust/50">清空进度、金币、错题等所有记录</div>
            </div>
            <NeonButton variant="danger" onClick={() => { playButton(); setShowReset(true) }} className="text-xs">
              重置
            </NeonButton>
          </div>
        </GlassCard>
      </section>

      {/* 关于 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-violet mb-2 px-1">ℹ️ 关于</h3>
        <GlassCard className="p-4 text-center">
          <div className="text-4xl mb-2">🪐</div>
          <div className="font-display font-bold text-lg neon-text-cyan">考证星球</div>
          <div className="text-[10px] text-stardust/50 font-mono mt-1">CERT · PLANET · v1.0.0</div>
          <p className="text-xs text-stardust/60 mt-3 leading-relaxed">
            太空赛博朋克风格的考证刷题 APP，支持飞行执照、无人机、无线电、中级经济师，融合 SM-2 间隔重复、游戏化激励、3D 模拟与多感官记忆。
          </p>
          <div className="flex flex-wrap justify-center gap-1 mt-3">
            {['React 18', 'Three.js', 'Zustand', 'Tailwind', 'Vite'].map((t) => (
              <span key={t} className="text-[9px] px-2 py-0.5 rounded-full glass text-stardust/60">{t}</span>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* 重置确认 */}
      <Modal open={showReset} onClose={() => setShowReset(false)} title="确认重置">
        <div className="text-center py-2">
          <div className="text-5xl mb-3">⚠️</div>
          <p className="text-sm text-stardust/80 mb-1">此操作不可撤销！</p>
          <p className="text-xs text-neon-red mb-4">所有进度、金币、错题、宠物都将清空</p>
          <div className="flex gap-2">
            <NeonButton variant="ghost" onClick={() => setShowReset(false)} className="flex-1 text-xs">取消</NeonButton>
            <NeonButton variant="danger" onClick={handleReset} className="flex-1 text-xs">确认重置</NeonButton>
          </div>
        </div>
      </Modal>

      {/* 导入确认 */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="确认导入存档">
        <div className="py-2">
          <p className="text-sm text-stardust/80 mb-3">导入将覆盖当前所有数据，确认继续？</p>
          {importText && (
            <div className="glass p-2 rounded-lg max-h-32 overflow-y-auto mb-3">
              <pre className="text-[10px] text-stardust/60 font-mono whitespace-pre-wrap break-all">
                {importText.slice(0, 500)}{importText.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
          <div className="flex gap-2">
            <NeonButton variant="ghost" onClick={() => setShowImport(false)} className="flex-1 text-xs">取消</NeonButton>
            <NeonButton variant="primary" onClick={handleImport} className="flex-1 text-xs">确认导入</NeonButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ToggleRow({
  label, desc, value, onChange,
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="text-sm text-stardust/80">{label}</div>
        <div className="text-[10px] text-stardust/50">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-all ${value ? 'bg-neon-cyan/30' : 'bg-white/10'}`}
        style={{ border: `1px solid ${value ? '#00f5ff' : '#ffffff20'}` }}
      >
        <motion.div
          animate={{ x: value ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full"
          style={{
            width: 18,
            height: 18,
            background: value ? '#00f5ff' : '#ffffff60',
            boxShadow: value ? '0 0 8px #00f5ff' : 'none',
          }}
        />
      </button>
    </div>
  )
}
