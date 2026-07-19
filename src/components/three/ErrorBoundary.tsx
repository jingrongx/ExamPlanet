import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}
interface State {
  hasError: boolean
}

// 3D 场景错误边界：WebGL 不可用时降级到 fallback
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // WebGL 不可用 / 3D 渲染失败时静默降级
    console.warn('[3D] 降级到 2D 模式:', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
