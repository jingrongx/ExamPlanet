import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { GlassCard, NeonButton, Modal, useToast } from '../components/ui'
import { UpdateModal } from '../components/ui/UpdateModal'
import { playButton, startAmbient, stopAmbient, speak, stopSpeak, setAudioEnabled, setAmbientEnabled, setSfxVolume, isTtsSupported, hasZhVoice } from '../engine/audio'
import { testApiKey } from '../services/ai'
import { checkForUpdate, getCurrentVersion, type UpdateInfo } from '../services/updater'

export function Settings() {
  const navigate = useNavigate()
  const toast = useToast()
  const { settings, updateSettings, exportData, importData, resetAll, userId, nickname } = useGameStore()
  const [showReset, setShowReset] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  // 用 ref + defaultValue 代替受控组件，避免 Android WebView 输入法合成事件
  // 导致 React onChange 收不到完整输入的问题（之前用户输入完整 key 但 state 只捕获到 1 字符）
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  // 获取输入框当前值（从 DOM 读取，不依赖 React state）
  const getApiKeyInput = () => (apiKeyInputRef.current?.value || '').trim()

  // 自动更新
  const [appVersion, setAppVersion] = useState('...')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdate, setShowUpdate] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  // 进入设置页读取当前版本号
  useEffect(() => {
    getCurrentVersion().then((v) => setAppVersion(v)).catch(() => setAppVersion('未知'))
  }, [])

  const handleCheckUpdate = async () => {
    playButton()
    setCheckingUpdate(true)
    setUpdateInfo(null)
    setShowUpdate(true)
    try {
      const info = await checkForUpdate()
      if (!info) {
        toast('检查更新失败，请检查网络后重试', 'error')
        setShowUpdate(false)
        return
      }
      setUpdateInfo(info)
      if (!info.hasUpdate) {
        toast(`已是最新版本 v${info.currentVersion}`, 'success')
        setShowUpdate(false)
      }
    } catch (err) {
      toast(`检查更新失败：${(err as Error).message}`, 'error')
      setShowUpdate(false)
    } finally {
      setCheckingUpdate(false)
    }
  }

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
    if (!settings.ttsEnabled) {
      toast('请先开启语音朗读', 'info')
      return
    }
    if (!isTtsSupported()) {
      toast('当前设备不支持语音朗读', 'error')
      return
    }
    if (!hasZhVoice()) {
      toast('⚠️ 未检测到中文语音引擎，请在系统设置→语言和输入→文字转语音输出中安装中文 TTS', 'error')
      return
    }
    speak('考证星球，祝你考试顺利通过', {
      onStart: () => toast('开始朗读', 'success'),
      onError: (msg) => toast(msg, 'error'),
    })
  }

  const saveApiKey = () => {
    playButton()
    const trimmed = getApiKeyInput()
    if (!trimmed) {
      toast('API Key 不能为空', 'info')
      return
    }
    updateSettings({ deepseekApiKey: trimmed })
    toast('API Key 已保存', 'success')
  }

  const handleTestApi = async () => {
    const trimmed = getApiKeyInput()
    if (!trimmed) {
      toast('请先填写 API Key', 'info')
      return
    }
    setTesting(true)
    toast('正在测试连接...', 'info')
    // 先保存最新值再测试
    updateSettings({ deepseekApiKey: trimmed })
    const result = await testApiKey(trimmed)
    setTesting(false)
    toast(result.message, result.ok ? 'success' : 'error')
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
            desc="朗读题目和解析（依赖系统中文 TTS 引擎）"
            value={settings.ttsEnabled}
            onChange={(v) => {
              toggle('ttsEnabled', v)
              if (v) {
                if (!isTtsSupported()) {
                  toast('当前设备不支持语音朗读', 'error')
                  return
                }
                if (!hasZhVoice()) {
                  toast('⚠️ 系统未安装中文 TTS 引擎，请到系统设置→文字转语音输出中安装', 'error')
                  return
                }
                speak('已开启语音朗读', {
                  onError: (msg) => toast(msg, 'error'),
                })
              }
            }}
          />
          {settings.ttsEnabled && !hasZhVoice() && (
            <div className="px-4 pb-3 text-[10px] text-neon-red/80 leading-relaxed">
              ⚠️ 当前未检测到中文语音引擎。请到「系统设置 → 语言和输入法 → 文字转语音输出」中安装/启用中文 TTS（如 Google 文字转语音引擎、华为/小米自带 TTS）。
            </div>
          )}
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

      {/* AI 解读设置 */}
      <section>
        <h3 className="font-display font-bold text-sm neon-text-cyan mb-2 px-1">🤖 AI 解读 · DeepSeek V4-Flash</h3>
        <GlassCard className="divide-y divide-white/5">
          <ToggleRow
            label="答题后 AI 解读"
            desc="每题答完后自动调用 AI 讲解题型、思路与背景知识"
            value={!!settings.aiInterpretEnabled}
            onChange={(v) => toggle('aiInterpretEnabled', v)}
          />
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-stardust/80">DeepSeek API Key</span>
                <button
                  onClick={() => setShowApiKey((s) => !s)}
                  className="text-[10px] text-neon-cyan hover:text-neon-pink"
                >
                  {showApiKey ? '隐藏' : '显示'}
                </button>
              </div>
              <input
                ref={apiKeyInputRef}
                type={showApiKey ? 'text' : 'password'}
                defaultValue={settings.deepseekApiKey || ''}
                placeholder="sk-xxxxxxxxxxxx"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 rounded-xl glass text-sm text-stardust placeholder-stardust/30 focus:outline-none focus:border-neon-cyan/50"
                style={{ border: '1px solid rgba(0,245,255,0.2)' }}
              />
              <div className="text-[10px] text-stardust/40 mt-1 leading-relaxed">
                到 <span className="font-mono text-neon-cyan/70">platform.deepseek.com</span> 控制台创建 API Key。Key 仅保存在本地，不上传任何服务器。
              </div>
            </div>
            <div className="flex gap-2">
              <NeonButton variant="secondary" onClick={saveApiKey} className="flex-1 text-xs">
                💾 保存 Key
              </NeonButton>
              <NeonButton
                variant="ghost"
                onClick={handleTestApi}
                disabled={testing}
                className="flex-1 text-xs"
              >
                {testing ? '测试中...' : '🔌 测试连接'}
              </NeonButton>
            </div>
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
            💡 数据已通过原生 SharedPreferences 持久化，覆盖安装不会丢失。
          </div>
          <div className="text-[10px] text-neon-red/70 leading-relaxed">
            ⚠️ <b>卸载应用会清空所有数据</b>（含进度、金币、错题、API Key）。卸载前请务必点击「导出存档」备份为 JSON 文件，重装后再「导入存档」恢复。
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
          <div className="text-[10px] text-stardust/50 font-mono mt-1">CERT · PLANET · v{appVersion}</div>
          <p className="text-xs text-stardust/60 mt-3 leading-relaxed">
            太空赛博朋克风格的考证刷题 APP，支持飞行执照、无人机、无线电、中级经济师，融合 SM-2 间隔重复、游戏化激励、3D 模拟与多感官记忆。
          </p>
          <div className="flex flex-wrap justify-center gap-1 mt-3">
            {['React 18', 'Three.js', 'Zustand', 'Tailwind', 'Vite'].map((t) => (
              <span key={t} className="text-[9px] px-2 py-0.5 rounded-full glass text-stardust/60">{t}</span>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5">
            <NeonButton
              variant="secondary"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="w-full text-xs"
            >
              {checkingUpdate ? '🔄 检查中…' : '🛰️ 检查更新'}
            </NeonButton>
            <div className="text-[10px] text-stardust/40 mt-1.5 leading-relaxed">
              启动时会自动检测新版本，也可手动点击检查。下载通过 ghproxy 加速。
            </div>
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

      {/* 更新提示 */}
      <UpdateModal
        open={showUpdate}
        onClose={() => setShowUpdate(false)}
        info={updateInfo}
        checking={checkingUpdate}
      />
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
