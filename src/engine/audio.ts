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

// TTS 朗读（原生优先 + Web Speech 降级）
//
// 重要：Android WebView 的 window.speechSynthesis 只能调用 Chrome 内置 TTS，
// 无法使用系统安装的第三方 TTS 引擎（如讯飞、华为、Google TTS）。
// 因此在原生环境必须用 @capacitor-community/text-to-speech 走 Android 原生 TextToSpeech API，
// 才能调用系统设置里安装的所有 TTS 引擎。
//
// 流程：
// - 原生环境：用 Capacitor TTS 插件 → Android TextToSpeech → 系统已装引擎（讯飞/华为/Google）
// - Web 环境：用浏览器 Web Speech API（开发调试用）

import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { stripMarkdown } from './markdown'

const isNative = typeof window !== 'undefined'
  && ((window as any).Capacitor?.isNative ?? false)

let currentUtterance: SpeechSynthesisUtterance | null = null
let webVoicesLoaded = false

function tryLoadWebVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices && voices.length > 0) webVoicesLoaded = true
  return voices || []
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      tryLoadWebVoices()
    }
    tryLoadWebVoices()
  } catch { /* ignore */ }
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onError?: (msg: string) => void
  onStart?: () => void
}

// 原生 TTS：调用 Capacitor 插件
async function speakNative(text: string, opts: SpeakOptions): Promise<void> {
  try {
    // 先停止上一个朗读
    await TextToSpeech.stop().catch(() => { /* ignore */ })

    opts.onStart?.()

    await TextToSpeech.speak({
      text,
      lang: 'zh-CN',
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      volume: 1.0,
    })
  } catch (err) {
    const msg = (err as Error)?.message || String(err)
    if (msg.includes('not installed') || msg.includes('no engine')) {
      opts.onError?.('系统未安装中文 TTS 引擎，请到「系统设置 → 文字转语音输出」中安装')
    } else if (msg.includes('language') || msg.includes('locale')) {
      opts.onError?.('TTS 引擎不支持中文，请安装中文 TTS 引擎')
    } else {
      opts.onError?.(`语音朗读失败：${msg}`)
    }
    console.error('[tts native] error:', err)
  }
}

// Web 端 TTS：用浏览器 Web Speech API
function speakWeb(text: string, opts: SpeakOptions): void {
  if (!('speechSynthesis' in window)) {
    opts.onError?.('当前浏览器不支持语音朗读')
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

    const voices = tryLoadWebVoices()
    const zhVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith('zh') ||
      v.lang.toLowerCase().includes('cmn'),
    )
    if (zhVoice) u.voice = zhVoice

    u.onstart = () => opts.onStart?.()
    u.onerror = (e) => {
      const errType = (e as any)?.error || 'unknown'
      let msg = '语音朗读失败'
      if (errType === 'not-allowed') msg = '语音朗读被浏览器拦截'
      else if (errType === 'no-speech') msg = '未检测到可用的语音引擎'
      else if (errType === 'synthesis-failed') msg = '语音合成失败'
      opts.onError?.(msg)
      console.error('[tts web] error:', errType)
    }

    currentUtterance = u
    window.speechSynthesis.cancel()
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

export function speak(text: string, opts: SpeakOptions = {}) {
  // 统一过滤 markdown 标记（# * ` > - 等），避免 TTS 朗读出符号
  const cleanText = stripMarkdown(text)
  if (!cleanText) return
  if (isNative) {
    // 原生：异步调用 Capacitor TTS
    speakNative(cleanText, opts)
  } else {
    // Web：用 Web Speech API（开发环境）
    speakWeb(cleanText, opts)
  }
}

export async function stopSpeak() {
  if (isNative) {
    await TextToSpeech.stop().catch(() => { /* ignore */ })
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    currentUtterance = null
  }
}

export async function isSpeaking(): Promise<boolean> {
  if (isNative) {
    // 插件未提供 isSpeaking，近似用 web 端 speechSynthesis.speaking
    return false
  }
  return 'speechSynthesis' in window && window.speechSynthesis.speaking
}

// 检测 TTS 是否可用
// - 原生：默认 true（Android 系统都内置 TextToSpeech 引擎）
// - Web：检测 Web Speech API
export function isTtsSupported(): boolean {
  if (isNative) return true
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// 检测是否有中文语音引擎
// - 原生：通过 Capacitor 插件 isLanguageSupported 检查
// - Web：通过 getVoices 检查
export async function hasZhVoice(): Promise<boolean> {
  if (isNative) {
    try {
      // 优先用 isLanguageSupported（更准确）
      const { supported } = await TextToSpeech.isLanguageSupported({ lang: 'zh-CN' })
      if (supported) return true
      // 备用：检查 getSupportedLanguages 列表
      const { languages } = await TextToSpeech.getSupportedLanguages()
      return (languages || []).some((l) => l.toLowerCase().startsWith('zh'))
    } catch (err) {
      console.warn('[tts] hasZhVoice detection failed:', err)
      // 出错时返回 true，让用户尝试 speak，由 speak 的 onError 反馈具体错误
      return true
    }
  }
  const voices = tryLoadWebVoices()
  return voices.some((v) =>
    v.lang.toLowerCase().startsWith('zh') ||
    v.lang.toLowerCase().includes('cmn'),
  )
}
