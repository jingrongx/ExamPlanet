import { Routes, Route } from 'react-router-dom'
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/ui'
import { UpdateModal } from './components/ui/UpdateModal'
import { checkForUpdate, type UpdateInfo } from './services/updater'
import { Hall } from './pages/Hall'
import { ChapterMap } from './pages/ChapterMap'
import { Quiz } from './pages/Quiz'
import { Mistakes } from './pages/Mistakes'
import { Exam } from './pages/Exam'
import { ExamResult } from './pages/ExamResult'
import { Memory } from './pages/Memory'
import { Base } from './pages/Base'
import { DataCenter } from './pages/DataCenter'
import { Settings } from './pages/Settings'

// 3D 重型页面懒加载
const Space3D = lazy(() => import('./pages/Space3D').then((m) => ({ default: m.Space3D })))

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-spin-slow">🛰️</div>
        <div className="font-tech text-neon-cyan tracking-widest animate-pulse">LOADING...</div>
      </div>
    </div>
  )
}

// 全局错误边界：避免子组件抛错导致整树崩溃白屏
interface ErrProps { children: ReactNode }
interface ErrState { error: Error | null }
class GlobalErrorBoundary extends Component<ErrProps, ErrState> {
  state: ErrState = { error: null }
  static getDerivedStateFromError(error: Error): ErrState {
    return { error }
  }
  componentDidCatch(error: unknown) {
    console.error('[App ErrorBoundary]', error)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-3">🛸</div>
          <div className="font-display text-lg font-bold text-neon-pink mb-2">页面异常</div>
          <div className="text-xs text-stardust/60 mb-4 max-w-xs break-all">{String(this.state.error.message)}</div>
          <button
            onClick={() => {
              this.setState({ error: null })
              location.href = '/'
            }}
            className="px-4 py-2 rounded-xl bg-neon-pink/20 text-neon-pink border border-neon-pink/50 text-sm"
          >
            返回星球大厅
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // 自动更新检测：启动后 3 秒静默检测，有更新才弹 Modal
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdate, setShowUpdate] = useState(false)
  const [checking, setChecking] = useState(false)
  // 本次启动是否已检测过（避免重复检测）
  const [checked, setChecked] = useState(false)

  // React 渲染完成后隐藏启动闪屏（避免闪屏过早移除导致黑屏）
  useEffect(() => {
    const boot = document.getElementById('boot')
    if (boot) {
      boot.classList.add('hide')
      const timer = setTimeout(() => boot.remove(), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  // 启动后自动检测更新（仅在原生环境，且本次启动只检测一次）
  useEffect(() => {
    if (checked) return
    const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!isNative) return
    setChecked(true)
    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const info = await checkForUpdate()
        if (info && info.hasUpdate) {
          setUpdateInfo(info)
          setShowUpdate(true)
        }
      } catch (err) {
        console.warn('[updater] auto check failed:', err)
      } finally {
        setChecking(false)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [checked])

  // app 进入后台/被划掉时，主动同步存档到磁盘
  // zustand persist 的 setItem 是异步的，用户快速划掉 app 时可能没写完
  // 这里在 pause 事件触发时，手动把最新的 state 写入 SharedPreferences(commit) + Documents
  useEffect(() => {
    const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!isNative) return
    let listener: { remove: () => Promise<void> } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app')
        const l = await CapApp.addListener('pause', async () => {
          try {
            const { useGameStore } = await import('./store/useGameStore')
            const { getPlugin } = await import('./store/preferencesStorage')
            const plugin = getPlugin()
            if (!plugin) return
            // 手动把最新的 state 写入磁盘（plugin.write 会同步 commit SharedPreferences）
            const state = useGameStore.getState()
            // 删除 actions 之类的函数字段，只保留数据
            const persistable = { ...state }
            const json = JSON.stringify({ state: persistable, version: 0 })
            await plugin.write({ value: json })
          } catch (err) {
            console.error('[app] pause flush failed:', err)
          }
        })
        if (!cancelled) {
          listener = l
        } else {
          l.remove()
        }
      } catch (err) {
        console.warn('[app] pause listener failed:', err)
      }
    })()
    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [])

  return (
    <ToastProvider>
      <GlobalErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
          <Route element={<Layout />}>
          <Route path="/" element={<Hall />} />
          <Route path="/license/:id" element={<ChapterMap />} />
          <Route path="/license/:id/quiz/:nodeId" element={<Quiz />} />
          <Route path="/mistakes" element={<Mistakes />} />
          <Route path="/exam/:id" element={<Exam />} />
          <Route path="/exam/:id/result" element={<ExamResult />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/space3d/:id" element={<Space3D />} />
          <Route path="/base" element={<Base />} />
          <Route path="/data" element={<DataCenter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Hall />} />
          </Route>
          </Routes>
        </Suspense>
      </GlobalErrorBoundary>
      <UpdateModal
        open={showUpdate}
        onClose={() => setShowUpdate(false)}
        info={updateInfo}
        checking={checking}
      />
    </ToastProvider>
  )
}
