import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/ui'
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

export default function App() {
  return (
    <ToastProvider>
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
    </ToastProvider>
  )
}
