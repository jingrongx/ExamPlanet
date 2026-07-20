import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { useGameStore } from './store/useGameStore'

// 隐藏启动闪屏（由 App 组件 useEffect 调用，确保 React 渲染完成后才隐藏）
export function hideBoot() {
  const boot = document.getElementById('boot')
  if (boot) {
    boot.classList.add('hide')
    setTimeout(() => boot.remove(), 500)
  }
}

// 启动入口：先 await store 完成 hydrate（从 Preferences 读取存档），再动态导入 App 并渲染
//
// 为什么这样设计？
// 1. useGameStore 用了 skipHydration: true，store 创建时不会自动 hydrate
// 2. 必须手动调用 rehydrate() 从 Preferences 异步读取存档
// 3. 必须在 React 渲染前完成 hydrate，否则 React 组件 useEffect 里的 set
//    会把 DEFAULT 值写回 storage，覆盖真实存档（这是之前丢失数据的根因）
// 4. App 用动态 import，确保 useGameStore 模块在 hydrate 完成后才被加载
async function bootstrap() {
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
