// 持久化存储适配器（供 zustand persist 使用）
//
// 目标：卸载 app 重装也不丢数据，全自动保存，用户无感知
//
// 存储层级（由 PersistentStoragePlugin 管理）：
// 1. SharedPreferences（commit 同步写入）：app 被划掉/杀死时数据不丢
// 2. Documents 文件（MediaStore/File API）：app 卸载重装数据不丢
//
// plugin.write 会先同步写入 SharedPreferences(commit)，再写入 Documents
// plugin.read 会优先读 Documents，读不到读 SharedPreferences
//
// 为什么用 skipHydration + 手动 rehydrate？
// zustand persist 的异步 storage 存在 hydrate 竞态：store 创建时返回 DEFAULT 值，
// 异步 hydrate 完成前如果 React 组件触发 set，会把 DEFAULT 值写回 storage，覆盖存档。
// 解决：skipHydration: true 跳过自动 hydrate，在 main.tsx 中 await rehydrate()
// 完成后再渲染 React，确保不会有 set 在 hydrate 之前发生。
//
// 旧版本迁移：之前用 Capacitor Preferences 存档，升级到新版本后需要迁移到新存储。

import { Preferences } from '@capacitor/preferences'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { StateStorage } from 'zustand/middleware'

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

interface PersistentStoragePlugin {
  read(): Promise<{ value?: string } | null>
  write(options: { value: string }): Promise<void>
  flush(): Promise<void>
  requestStoragePermission(): Promise<{ granted: boolean }>
}

let pluginCache: PersistentStoragePlugin | null = null
export function getPlugin(): PersistentStoragePlugin | null {
  if (!isNative) return null
  if (pluginCache) return pluginCache
  try {
    pluginCache = registerPlugin<PersistentStoragePlugin>('PersistentStorage')
    return pluginCache
  } catch (err) {
    console.error('[storage] registerPlugin PersistentStorage failed:', err)
    return null
  }
}

// 内存缓存：避免每次 getItem 都走原生 IPC
let memoryCache: { key: string; value: string | null } | null = null
const migratedKeys = new Set<string>()

// 权限就绪 Promise：main.tsx 中 requestStoragePermission 完成后 resolve
let permissionResolve: ((v: boolean) => void) | null = null
const permissionPromise: Promise<boolean> = new Promise((resolve) => {
  permissionResolve = resolve
})
export function setPermissionReady(v: boolean) {
  if (permissionResolve) {
    permissionResolve(v)
    permissionResolve = null
  }
}

async function readFromNative(name: string): Promise<string | null> {
  console.error('[storage] getItem called, name:', name)
  if (memoryCache && memoryCache.key === name) {
    console.error('[storage] return from memoryCache:', memoryCache.value?.length, 'chars')
    return memoryCache.value
  }
  const granted = await permissionPromise
  if (!granted) {
    console.error('[storage] permission denied, skip read')
    return null
  }
  const plugin = getPlugin()
  if (!plugin) {
    console.error('[storage] plugin not available')
    return null
  }

  try {
    const result = await plugin.read()
    const value = result?.value ?? null
    console.error('[storage] plugin.read returned:', value?.length, 'chars')
    if (value) {
      memoryCache = { key: name, value }
      return value
    }

    // 新存储没有数据，尝试从旧版本 Capacitor Preferences 迁移
    if (!migratedKeys.has(name)) {
      migratedKeys.add(name)
      try {
        const { value: prefValue } = await Preferences.get({ key: name })
        if (prefValue) {
          console.error('[storage] migrating from Capacitor Preferences:', name, 'len:', prefValue.length)
          await plugin.write({ value: prefValue })
          memoryCache = { key: name, value: prefValue }
          return prefValue
        }
      } catch { /* ignore */ }
    }
    memoryCache = { key: name, value: null }
    return null
  } catch (err) {
    console.error('[storage] read failed:', err)
    return null
  }
}

async function writeToNative(name: string, value: string): Promise<void> {
  // 立即更新内存缓存（即使磁盘写入失败，本次会话内仍能读到最新值）
  memoryCache = { key: name, value }
  const granted = await permissionPromise
  if (!granted) {
    console.error('[storage] permission denied, skip write')
    return
  }
  const plugin = getPlugin()
  if (!plugin) return
  try {
    // plugin.write 会先同步写入 SharedPreferences(commit)，再写入 Documents
    // commit() 是同步的，返回时数据已经写入磁盘，app 被杀死也不会丢
    await plugin.write({ value })
  } catch (err) {
    console.error('[storage] write failed:', err)
  }
}

// 供 App.tsx 在 app 进入后台时调用，确保最新数据写入磁盘
export async function flushStorage(): Promise<void> {
  if (!isNative) return
  const plugin = getPlugin()
  if (!plugin) return
  try {
    await plugin.flush()
  } catch (err) {
    console.error('[storage] flush failed:', err)
  }
}

export const preferencesStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isNative) {
      return await readFromNative(name)
    }
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isNative) {
      await writeToNative(name, value)
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
      // 写入空对象标记删除（plugin.write 会同步写入 SharedPreferences）
      try {
        const plugin = getPlugin()
        if (plugin) {
          await plugin.write({ value: '{}' })
        }
      } catch { /* ignore */ }
      try {
        await Preferences.remove({ key: name })
      } catch { /* ignore */ }
      return
    }
    try {
      localStorage.removeItem(name)
    } catch { /* ignore */ }
  },
}
