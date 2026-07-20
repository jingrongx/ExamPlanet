// Zustand persist 的 StateStorage 适配器
// 优先使用 @capacitor/preferences（Android SharedPreferences / iOS NSUserDefaults）
// 这样数据存在原生层，而不是 WebView 的 localStorage，
// 卸载时虽然仍会被清除，但配合 Android Auto Backup (allowBackup=true) 可备份到 Google Drive，
// 重装时自动恢复；同时避免 WebView 缓存清理误伤。
//
// Capacitor Preferences 是异步 API，zustand persist 支持异步 StateStorage。
// 在 Web 端（开发环境）自动降级到 localStorage。

import { Preferences } from '@capacitor/preferences'
import type { StateStorage } from 'zustand/middleware'

const isNative = typeof window !== 'undefined'
  && ((window as any).Capacitor?.isNative ?? false)

export const prefStorage: StateStorage = {
  async getItem(name: string): Promise<string | null> {
    if (isNative) {
      try {
        const { value } = await Preferences.get({ key: name })
        return value
      } catch (err) {
        console.error('[prefStorage] getItem failed:', err)
        return null
      }
    }
    // Web 端降级
    return localStorage.getItem(name)
  },
  async setItem(name: string, value: string): Promise<void> {
    if (isNative) {
      try {
        await Preferences.set({ key: name, value })
      } catch (err) {
        console.error('[prefStorage] setItem failed:', err)
      }
      return
    }
    localStorage.setItem(name, value)
  },
  async removeItem(name: string): Promise<void> {
    if (isNative) {
      try {
        await Preferences.remove({ key: name })
      } catch (err) {
        console.error('[prefStorage] removeItem failed:', err)
      }
      return
    }
    localStorage.removeItem(name)
  },
}

// 一次性把旧的 localStorage 存档迁移到 Preferences（仅原生环境，首次升级时执行一次）
export async function migrateLegacyIfNeeded(newKey: string): Promise<void> {
  if (!isNative) return
  try {
    const legacy = localStorage.getItem(newKey)
    if (!legacy) return
    // 已经迁移过则跳过
    const { value } = await Preferences.get({ key: newKey })
    if (value) return
    await Preferences.set({ key: newKey, value: legacy })
    localStorage.removeItem(newKey)
    console.log('[prefStorage] migrated legacy localStorage to Preferences, len=', legacy.length)
  } catch (err) {
    console.error('[prefStorage] migrate failed:', err)
  }
}
