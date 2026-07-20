// Web Audio API 合成音效（无需 mp3 文件）
let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let ambientNode: { osc: OscillatorNode; gain: GainNode } | null = null

let enabled = true
let ambientEnabled = true
let sfxVolume = 0.5

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 1
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setAudioEnabled(v: boolean) {
  enabled = v
}

export function setAmbientEnabled(v: boolean) {
  ambientEnabled = v
  if (!v && ambientNode) {
    ambientNode.gain.gain.setTargetAtTime(0, getCtx().currentTime, 0.1)
  } else if (v && ambientNode) {
    ambientNode.gain.gain.setTargetAtTime(0.04, getCtx().currentTime, 0.5)
  }
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(1, v))
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.3,
  attack = 0.005,
  release = 0.1,
) {
  if (!enabled) return
  const c = getCtx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(masterGain!)
  const now = c.currentTime
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(vol * sfxVolume, now + attack)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration + release)
  osc.start(now)
  osc.stop(now + duration + release + 0.05)
}

function sweep(
  fromFreq: number,
  toFreq: number,
  duration: number,
  type: OscillatorType = 'sawtooth',
  vol = 0.2,
) {
  if (!enabled) return
  const c = getCtx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.connect(g)
  g.connect(masterGain!)
  const now = c.currentTime
  osc.frequency.setValueAtTime(fromFreq, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), now + duration)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(vol * sfxVolume, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration)
  osc.start(now)
  osc.stop(now + duration + 0.05)
}

// 答对：清脆叮咚+金币声
export function playCorrect() {
  tone(880, 0.08, 'triangle', 0.3)
  setTimeout(() => tone(1318, 0.12, 'triangle', 0.3), 60)
  setTimeout(() => tone(1760, 0.15, 'sine', 0.25), 120)
}

// 答错：低沉心跳+下行
export function playWrong() {
  tone(180, 0.18, 'sawtooth', 0.25)
  setTimeout(() => tone(140, 0.25, 'sawtooth', 0.2), 100)
}

// 金币掉落
export function playCoin() {
  tone(988, 0.05, 'square', 0.18)
  setTimeout(() => tone(1318, 0.1, 'square', 0.18), 40)
}

// 连击声（音调随 combo 上升）
export function playCombo(combo: number) {
  const base = 440 + Math.min(combo, 20) * 30
  tone(base, 0.06, 'triangle', 0.18)
  setTimeout(() => tone(base * 1.5, 0.08, 'triangle', 0.18), 30)
}

// 暴击：金光闪烁声
export function playCrit() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => tone(1200 + i * 200, 0.08, 'sine', 0.25), i * 40)
  }
}

// 升级：号角
export function playLevelUp() {
  tone(523, 0.12, 'sawtooth', 0.25)
  setTimeout(() => tone(659, 0.12, 'sawtooth', 0.25), 120)
  setTimeout(() => tone(784, 0.12, 'sawtooth', 0.25), 240)
  setTimeout(() => tone(1047, 0.3, 'sawtooth', 0.3), 360)
}

// 关卡通过
export function playStageClear() {
  tone(659, 0.1, 'triangle', 0.25)
  setTimeout(() => tone(784, 0.1, 'triangle', 0.25), 100)
  setTimeout(() => tone(988, 0.15, 'triangle', 0.25), 200)
  setTimeout(() => tone(1319, 0.3, 'sine', 0.3), 320)
}

// 按钮点击
export function playButton() {
  tone(660, 0.04, 'square', 0.1)
}

// 进度/解锁
export function playUnlock() {
  sweep(220, 880, 0.3, 'triangle', 0.2)
}

// 失败重置
export function playReset() {
  sweep(880, 110, 0.4, 'sawtooth', 0.2)
}

// 启动环境音（低频星云背景）
export function startAmbient() {
  if (!ambientEnabled) return
  const c = getCtx()
  if (ambientNode) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = 55
  g.gain.value = 0
  osc.connect(g)
  g.connect(masterGain!)
  osc.start()
  // LFO 调制
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.1
  lfoGain.gain.value = 8
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  lfo.start()
  g.gain.setTargetAtTime(0.04, c.currentTime, 1)
  ambientNode = { osc, gain: g }
}

export function stopAmbient() {
  if (ambientNode) {
    const c = getCtx()
    ambientNode.gain.gain.setTargetAtTime(0, c.currentTime, 0.3)
    const old = ambientNode
    setTimeout(() => {
      try {
        old.osc.stop()
      } catch (e) {}
    }, 500)
    ambientNode = null
  }
}

// TTS 朗读（Android WebView 兼容版）
// - voices 异步加载：首次调用时若没拿到中文 voice 会等 onvoiceschanged
// - Android WebView 上 speechSynthesis.speak 必须在用户交互后触发
//   （由调用方在 onClick 等回调里调用 speak 即可满足）
// - 失败时通过 onError 回调让 UI 提示
let currentUtterance: SpeechSynthesisUtterance | null = null

function tryLoadVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  const voices = window.speechSynthesis.getVoices()
  return voices || []
}

// 监听 voices 加载完成（Chrome/WebView 异步触发）
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      tryLoadVoices()
    }
    // 主动尝试一次
    tryLoadVoices()
  } catch { /* ignore */ }
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onError?: (msg: string) => void
  onStart?: () => void
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!('speechSynthesis' in window)) {
    opts.onError?.('当前设备不支持语音朗读（Web Speech API 不可用）')
    return
  }
  try {
    if (currentUtterance) {
      window.speechSynthesis.cancel()
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = opts.rate ?? 1
    u.pitch = opts.pitch ?? 1

    // 拿中文语音（兼容 zh-CN / zh_CN / cmn 等）
    const voices = tryLoadVoices()
    const zhVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith('zh') ||
      v.lang.toLowerCase().includes('cmn'),
    )
    if (zhVoice) u.voice = zhVoice

    u.onstart = () => opts.onStart?.()
    u.onerror = (e) => {
      const errType = (e as any)?.error || 'unknown'
      let msg = '语音朗读失败'
      if (errType === 'not-allowed') msg = '语音朗读被系统拦截，请检查系统 TTS 引擎'
      else if (errType === 'no-speech') msg = '未检测到可用的语音引擎'
      else if (errType === 'synthesis-failed') msg = '语音合成失败，可能缺少中文 TTS 引擎'
      opts.onError?.(msg)
      console.error('[tts] error:', errType)
    }

    currentUtterance = u
    // Android WebView 偶发不发声：先 cancel 再 speak 更稳
    window.speechSynthesis.cancel()
    // 短延迟确保 cancel 完成
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(u)
      } catch (err) {
        opts.onError?.(`语音朗读异常：${(err as Error).message}`)
      }
    }, 50)
  } catch (err) {
    opts.onError?.(`语音朗读初始化失败：${(err as Error).message}`)
  }
}

export function stopSpeak() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    currentUtterance = null
  }
}

export function isSpeaking() {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking
}

// 检测 TTS 是否可用（用于 UI 提示）
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// 检测是否有中文语音引擎
export function hasZhVoice(): boolean {
  const voices = tryLoadVoices()
  return voices.some((v) =>
    v.lang.toLowerCase().startsWith('zh') ||
    v.lang.toLowerCase().includes('cmn'),
  )
}
