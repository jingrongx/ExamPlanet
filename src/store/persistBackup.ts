// 存档备份与恢复：用 @capacitor/preferences (Android SharedPreferences) 作为 localStorage 的备份
//
// 背景：
// 在部分 Android WebView 环境下，localStorage 会出现"关闭 app 后数据清空"的问题
// （即使 WebView 理论上应该持久化）。为了兜底，我们把存档同步写入 Preferences，
// 启动时如果 localStorage 为空，就从 Preferences 恢复。
//
// 设计要点：
// - zustand persist 仍然用 localStorage（同步，避免异步 storage 的 hydrate 竞态）
// - Preferences 只做备份，不直接给 zustand 用
// - 启动时先恢复，再渲染 React；写入时 debounce，避免频繁 IO
//
// 注意：Preferences 的 key 与 zustand persist 的 name 一致，都是 'cert-planet-save'

import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

const BACKUP_KEY = 'cert-planet-save'

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

/**
 * 启动时从 Preferences 恢复存档到 localStorage
 * 必须在 React 渲染前调用，保证 zustand persist 能读到数据
 */
export async function restoreFromBackup(): Promise<void> {
  if (!isNative) return
  try {
    // 先检查 localStorage 是否有数据
    const local = localStorage.getItem(BACKUP_KEY)
    if (local) {
      // localStorage 有数据，说明上次正常退出，不需要恢复
      // 但还是同步一份到 Preferences 作为备份（防止下次 localStorage 失效）
      await Preferences.set({ key: BACKUP_KEY, value: local }).catch(() => {})
      return
    }

    // localStorage 为空，尝试从 Preferences 恢复
    const { value } = await Preferences.get({ key: BACKUP_KEY })
    if (value) {
      console.error('[persist] restoring from Preferences backup, length:', value.length)
      localStorage.setItem(BACKUP_KEY, value)
    } else {
      console.error('[persist] no backup found, first launch or clean install')
    }
  } catch (err) {
    console.error('[persist] restoreFromBackup failed:', err)
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 把当前 localStorage 存档同步到 Preferences（debounce 1 秒）
 * 在 store 变化时调用
 */
export function syncToBackup(): void {
  if (!isNative) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      const data = localStorage.getItem(BACKUP_KEY)
      if (data) {
        await Preferences.set({ key: BACKUP_KEY, value: data })
      }
    } catch (err) {
      console.error('[persist] syncToBackup failed:', err)
    }
  }, 1000)
}
