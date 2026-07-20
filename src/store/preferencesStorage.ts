// 持久化存储适配器（供 zustand persist 使用）
//
// 目标：卸载 app 重装也不丢数据，全自动保存，用户无感知
//
// 存储层级（按优先级）：
// 1. 自定义 Capacitor 插件 PersistentStorage：写公共 Documents 目录
//    /storage/emulated/0/Documents/cert-planet/cert-planet-save.json
//    Android 11+ 用 MediaStore API（无需权限，卸载不丢）
//    Android 10- 用 File API（需 WRITE_EXTERNAL_STORAGE 权限，maxSdkVersion=29）
// 2. @capacitor/preferences (SharedPreferences)：应用专属存储，卸载会丢，作为备份
// 3. localStorage：Web 开发环境降级
//
// 为什么用 skipHydration + 手动 rehydrate？
// zustand persist 的异步 storage 存在 hydrate 竞态：store 创建时返回 DEFAULT 值，
// 异步 hydrate 完成前如果 React 组件触发 set，会把 DEFAULT 值写回 storage，覆盖存档。
// 解决：skipHydration: true 跳过自动 hydrate，在 main.tsx 中 await rehydrate()
// 完成后再渲染 React，确保不会有 set 在 hydrate 之前发生。
//
// 旧版本迁移：之前用 localStorage 或 Preferences 存档，升级到新版本后 Documents 文件可能为空。
// 首次读不到时尝试从 Preferences/localStorage 迁移，并写入 Documents。

import { Preferences } from '@capacitor/preferences'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { StateStorage } from 'zustand/middleware'

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

interface PersistentStoragePlugin {
  read(): Promise<{ value?: string } | null>
  write(options: { value: string }): Promise<void>
}

// 缓存插件实例，避免每次都走 Capacitor.registerPlugin
let pluginCache: PersistentStoragePlugin | null = null
function getPlugin(): PersistentStoragePlugin | null {
  if (!isNative) return null
  if (pluginCache) return pluginCache
  try {
    // registerPlugin 在 Web 环境会返回 proxy，调用时才会失败
    // 在原生环境且插件未注册时也会返回 proxy，调用时抛错
    pluginCache = registerPlugin<PersistentStoragePlugin>('PersistentStorage')
    return pluginCache
  } catch (err) {
    console.error('[storage] registerPlugin PersistentStorage failed:', err)
    return null
  }
}

// 内存缓存：避免每次 getItem 都走原生 IPC（性能优化）
let memoryCache: { key: string; value: string | null } | null = null
const migratedKeys = new Set<string>()

async function readFromDocuments(name: string): Promise<string | null> {
  // 优先用内存缓存
  if (memoryCache && memoryCache.key === name) {
    return memoryCache.value
  }
  const plugin = getPlugin()
  if (!plugin) return null

  try {
    const result = await plugin.read()
    const value = result?.value ?? null
    memoryCache = { key: name, value }
    if (value) return value

    // Documents 没有数据，尝试从旧存储迁移（localStorage / Preferences）
    if (!migratedKeys.has(name)) {
      migratedKeys.add(name)
      try {
        const legacy = localStorage.getItem(name)
        if (legacy) {
          console.error('[storage] migrating from localStorage to Documents:', name, 'len:', legacy.length)
          await plugin.write({ value: legacy })
          localStorage.removeItem(name)
          memoryCache = { key: name, value: legacy }
          return legacy
        }
      } catch { /* ignore */ }
      try {
        const { value: prefValue } = await Preferences.get({ key: name })
        if (prefValue) {
          console.error('[storage] migrating from Preferences to Documents:', name, 'len:', prefValue.length)
          await plugin.write({ value: prefValue })
          await Preferences.remove({ key: name })
          memoryCache = { key: name, value: prefValue }
          return prefValue
        }
      } catch { /* ignore */ }
    }
    return null
  } catch (err) {
    console.error('[storage] readFromDocuments failed:', err)
    return null
  }
}

async function writeToDocuments(name: string, value: string): Promise<void> {
  memoryCache = { key: name, value }
  const plugin = getPlugin()
  if (!plugin) return
  try {
    await plugin.write({ value })
  } catch (err) {
    console.error('[storage] writeToDocuments failed:', err)
  }
  // 同时备份到 Preferences（双写，Documents 万一失败也能恢复）
  try {
    await Preferences.set({ key: name, value })
  } catch { /* ignore */ }
}

export const preferencesStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isNative) {
      const v = await readFromDocuments(name)
      if (v !== null) return v
      // Documents 读不到且迁移也失败，降级到 Preferences
      try {
        const { value } = await Preferences.get({ key: name })
        return value
      } catch {
        return null
      }
    }
    // Web 环境
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isNative) {
      await writeToDocuments(name, value)
      return
    }
    try {
      localStorage.setItem(name, value)
    } catch (err) {
      console.error('[storage] setItem failed:', err)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    memoryCache = null
    if (isNative) {
      // Documents 不支持删除，写入空字符串标记
      // 实际上 zustand persist 只在 resetAll 时调用 removeItem，
      // 此时 store 已经用 DEFAULT 值覆盖，Documents 会被写入 DEFAULT 值
      try {
        await Preferences.remove({ key: name })
      } catch { /* ignore */ }
    }
    try {
      localStorage.removeItem(name)
    } catch { /* ignore */ }
  },
}
