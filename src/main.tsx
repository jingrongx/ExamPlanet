import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// 隐藏启动闪屏
function hideBoot() {
  const boot = document.getElementById('boot')
  if (boot) {
    boot.classList.add('hide')
    setTimeout(() => boot.remove(), 500)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// 渲染后隐藏闪屏
requestAnimationFrame(() => {
  hideBoot()
  setTimeout(hideBoot, 1500)
})

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
