import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.certplanet.app',
  appName: '考证星球',
  webDir: 'dist',
  backgroundColor: '#050818',
  android: {
    backgroundColor: '#050818',
    allowMixedContent: false,
    captureInput: true,
    // 启用 WebView 硬件加速，保障 Three.js 3D 性能
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#050818',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      // 沉浸式状态栏，文字白色适配深色背景
      style: 'LIGHT',
      backgroundColor: '#050818',
      overlaysWebView: true,
    },
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
