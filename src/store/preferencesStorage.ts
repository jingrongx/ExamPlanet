// Capacitor Preferences 存储适配器（供 zustand persist 使用）
//
// 为什么用 Preferences 而不是 localStorage？
// 在部分 Android WebView 环境下，localStorage 会出现"关闭 app 后数据清空"的问题
// （即使 WebView 理论上应该持久化）。@capacitor/preferences 在 Android 上走
// SharedPreferences（持久化到应用专属目录），在 Web 上降级到 localStorage。
//
// 为什么用 skipHydration + 手动 rehydrate？
// zustand persist 的异步 storage 存在 hydrate 竞态：store 创建时返回 DEFAULT 值，
// 异步 hydrate 完成前如果 React 组件触发 set，会把 DEFAULT 值写回 storage，覆盖存档。
// 解决：skipHydration: true 跳过自动 hydrate，在 main.tsx 中 await rehydrate()
// 完成后再渲染 React，确保不会有 set 在 hydrate 之前发生。
//
// 旧版本迁移：之前用 localStorage 存档，升级到新版本后 Preferences 是空的。
// getItem 时如果 Preferences 没有数据，尝试从 localStorage 读取并迁移过来。

import { Preferences } from '@capacitor/preferences'
import type { StateStorage } from 'zustand/middleware'

const migratedKeys = new Set<string>()

export const preferencesStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key: name })
      if (value) return value

      // Preferences 没有数据，尝试从 localStorage 迁移（旧版本升级场景）
      if (!migratedKeys.has(name)) {
        migratedKeys.add(name)
        try {
          const legacy = localStorage.getItem(name)
          if (legacy) {
            console.error('[storage] migrating from localStorage:', name, 'len:', legacy.length)
            await Preferences.set({ key: name, value: legacy })
            // 迁移后清除 localStorage，避免下次重复检查
            localStorage.removeItem(name)
            return legacy
          }
        } catch {
          /* localStorage 不可用时忽略 */
        }
      }
      return null
    } catch (err) {
      console.error('[storage] getItem failed:', err)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key: name, value })
    } catch (err) {
      console.error('[storage] setItem failed:', err)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await Preferences.remove({ key: name })
    } catch (err) {
      console.error('[storage] removeItem failed:', err)
    }
  },
}

