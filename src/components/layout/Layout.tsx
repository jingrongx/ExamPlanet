import { Outlet, useLocation } from 'react-router-dom'
import { StarField } from '../effects/StarField'
import { Header } from './Header'
import { TabBar } from './TabBar'

// 全屏沉浸页面（无 Header/TabBar）
const IMMERSIVE = ['/license/']

export function Layout() {
  const location = useLocation()
  // 答题 / 3D 模拟空间采用沉浸式布局
  const isImmersive =
    IMMERSIVE.some((p) => location.pathname.includes(`${p}`) && location.pathname.includes('/quiz')) ||
    location.pathname.includes('/quiz') ||
    location.pathname.includes('/space3d') ||
    location.pathname.includes('/exam/')

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <StarField />
      <div className="relative z-10">
        {!isImmersive && <Header />}
        <main className={isImmersive ? '' : 'pt-24 pb-28 px-3 max-w-5xl mx-auto min-h-screen'}>
          <Outlet />
        </main>
        {!isImmersive && <TabBar />}
      </div>
    </div>
  )
}
