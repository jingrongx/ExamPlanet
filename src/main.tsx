import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

// 隐藏启动闪屏（由 App 组件 useEffect 调用，确保 React 渲染完成后才隐藏）
export function hideBoot() {
  const boot = document.getElementById('boot')
  if (boot) {
    boot.classList.add('hide')
    setTimeout(() => boot.remove(), 500)
  }
}

// 启动入口：
// 1. MainActivity.onCreate 已主动用 ActivityCompat.requestPermissions 请求权限
// 2. JS 端循环检查权限状态，等待用户授权（最多 15 秒）
// 3. 动态加载 useGameStore 模块（避免模块加载时就触发 read）
// 4. await rehydrate() 从 Documents 文件恢复存档
// 5. 动态加载 App 并渲染
//
// 为什么要动态加载 useGameStore？
// zustand persist 即使设置了 skipHydration: true，store 创建时仍会调用 storage.getItem
// 预读存档。如果在权限授权前加载 store，Android 10 重装后 read 会因权限不足失败。
// 所以必须先等权限授权，再加载 store 模块。
async function bootstrap() {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    try {
      const { registerPlugin } = await import('@capacitor/core')
      const plugin = registerPlugin<PersistentStoragePlugin>('PersistentStorage')
      // 循环等待权限授权：MainActivity.onCreate 已经弹出权限对话框
      // Android 11+ 立即返回 granted=true，循环退出
      // Android 10- 每 500ms 检查一次，等用户点"允许"后退出，最多等 15 秒
      const start = Date.now()
      let granted = false
      while (Date.now() - start < 15000) {
        const result = await plugin.requestStoragePermission()
        granted = result.granted === true
        if (granted) break
        await new Promise(r => setTimeout(r, 500))
      }
      console.error('[bootstrap] storage permission:', granted, 'after', Date.now() - start, 'ms')
    } catch (e) {
      console.error('[bootstrap] permission check failed:', e)
    }
  }
  // 标记权限就绪，允许 preferencesStorage 读写 Documents
  const { setPermissionReady } = await import('./store/preferencesStorage')
  setPermissionReady(true)
  // 动态加载 store，确保权限流程已完成
  const { useGameStore } = await import('./store/useGameStore')
  try {
    await useGameStore.persist.rehydrate()
    console.error('[bootstrap] rehydrate done')
  } catch (e) {
    console.error('[bootstrap] rehydrate failed:', e)
  }
  const [{ default: App }] = await Promise.all([import('./App')])
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

// PersistentStorage 插件类型（仅用于本文件内的 requestStoragePermission 调用）
interface PersistentStoragePlugin {
  requestStoragePermission(): Promise<{ granted: boolean }>
}

bootstrap()

// 移动端：禁止双击缩放、长按选中等默认行为
if (typeof window !== 'undefined') {
  let lastTouch = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouch < 300) e.preventDefault()
    lastTouch = now
  }, { passive: false })

  document.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT' && !(e.target as HTMLElement).isContentEditable) {
      e.preventDefault()
    }
  })
}

// Capacitor 原生插件初始化（仅在 APP 环境内生效，Web 端自动跳过）
async function initNative() {
  try {
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()
    if (!isNative) return

    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#050818' })
    // 显式启用状态栏覆盖 WebView（沉浸式），配合 CSS --safe-top 避让
    // Android 上 env(safe-area-inset-top) 经常返回 0，已在 index.css 用 max() 兜底 24px
    try {
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch (e) {
      // 部分 Android 版本不支持该 API，忽略
    }

    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()

    // Android 返回键：优先 history.back，否则退出
    const { App: CapApp } = await import('@capacitor/app')
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        CapApp.exitApp()
      }
    })
  } catch (e) {
    // Web 环境或插件未就绪，静默
  }
}
initNative()
