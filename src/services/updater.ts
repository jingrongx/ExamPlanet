// 自动更新服务：从 GitHub Releases 检测新版本，用 ghproxy 镜像加速下载
// 国内访问 GitHub 不稳定，所以下载链接统一走 ghproxy.net 加速
// GitHub API 用直连（通常能通，慢一点但能拿到数据），失败时降级到镜像

import { CapacitorHttp } from '@capacitor/core'
import { App } from '@capacitor/app'

const GITHUB_REPO = 'jingrongx/ExamPlanet'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

// GitHub 下载加速镜像列表（按优先级排序，第一个失败用第二个）
// ghproxy.net 是国内常用的 GitHub 加速
// ghproxy/99988866 等是社区维护的备用镜像
const DOWNLOAD_MIRRORS = [
  'https://ghproxy.net/https://github.com',
  'https://gh-proxy.com/https://github.com',
  'https://ghproxy.cc/https://github.com',
  'https://github.com',
]

// GitHub API 镜像（API 不一定能用 ghproxy 加速，备用）
const API_MIRRORS = [
  GITHUB_API,
  `https://ghproxy.net/https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
]

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  changelog: string
  releaseName: string
  publishedAt: string
  apkUrl: string
  apkSize: number
  apkName: string
}

export interface ReleaseInfo {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
    content_type: string
  }>
}

// 比较版本号：格式 'YYYY.MM.DD.NN' 或 'vYYYY.MM.DD.NN'
// 返回 1 表示 a > b，-1 表示 a < b，0 表示相等
export function compareVersions(a: string, b: string): number {
  const norm = (v: string) => v.trim().replace(/^v/i, '').trim()
  const pa = norm(a).split('.').map((x) => parseInt(x, 10) || 0)
  const pb = norm(b).split('.').map((x) => parseInt(x, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// 获取当前 APP 版本号（versionName，如 '2026.07.20.15'）
export async function getCurrentVersion(): Promise<string> {
  try {
    const info = await App.getInfo()
    return info.version || '0.0.0.0'
  } catch {
    // Web 开发环境返回一个占位版本号
    return '0.0.0.0'
  }
}

// 用 CapacitorHttp 调用 GitHub API 获取最新 release
async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  for (const url of API_MIRRORS) {
    try {
      const resp = await CapacitorHttp.get({
        url,
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'CertPlanet-App-Updater',
        },
        // 10 秒超时，避免卡死
        connectTimeout: 10000,
        readTimeout: 10000,
      })
      if (resp.status === 200 && resp.data) {
        return resp.data as ReleaseInfo
      }
      console.warn('[updater] API mirror failed:', url, resp.status)
    } catch (err) {
      console.warn('[updater] API mirror error:', url, err)
    }
  }
  return null
}

// 给定 GitHub release 的原始下载 URL，构造加速链接列表
// rawUrl 形如 https://github.com/jingrongx/ExamPlanet/releases/download/v1/cert-planet-1.apk
// mirror 形如 https://ghproxy.net/https://github.com
// 拼接结果应为 https://ghproxy.net/https://github.com/jingrongx/ExamPlanet/releases/download/v1/cert-planet-1.apk
function getAcceleratedUrls(rawUrl: string): string[] {
  return DOWNLOAD_MIRRORS.map((mirror) => {
    if (mirror.endsWith('github.com')) {
      // 最后一个 mirror 是直连，直接返回原始 URL
      return rawUrl
    }
    // mirror 已经包含 'https://github.com'，所以直接把 rawUrl 拼到 mirror 后面
    // 因为 rawUrl 也是以 'https://github.com' 开头，正好重叠
    // 例：mirror='https://ghproxy.net/https://github.com' + rawUrl='https://github.com/jingrongx/...'
    // 结果='https://ghproxy.net/https://github.com/jingrongx/...'
    return `${mirror}${rawUrl.replace(/^https:\/\/github\.com/, '')}`
  })
}

// 检测是否有更新
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = await getCurrentVersion()
  const release = await fetchLatestRelease()
  if (!release) return null

  const latestVersion = release.tag_name
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

  // 找 APK asset
  const apkAsset = release.assets?.find(
    (a) => a.name.endsWith('.apk') && a.content_type === 'application/vnd.android.package-archive',
  ) || release.assets?.find((a) => a.name.endsWith('.apk'))

  if (!apkAsset) {
    console.warn('[updater] no apk asset in release')
    return null
  }

  // 默认用第一个加速镜像
  const acceleratedUrls = getAcceleratedUrls(apkAsset.browser_download_url)
  const apkUrl = acceleratedUrls[0]

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    changelog: release.body || '（暂无更新说明）',
    releaseName: release.name || release.tag_name,
    publishedAt: release.published_at || '',
    apkUrl,
    apkSize: apkAsset.size || 0,
    apkName: apkAsset.name,
  }
}

// 打开下载链接（在系统浏览器中打开，由系统下载器接管）
// info.apkUrl 已经是构造好的加速链接（第一个镜像），直接用即可
export async function downloadApk(info: UpdateInfo): Promise<void> {
  try {
    const win = window.open(info.apkUrl, '_system')
    if (!win) {
      // 弹窗被拦截，降级用 <a> 标签点击
      const a = document.createElement('a')
      a.href = info.apkUrl
      a.target = '_blank'
      a.rel = 'noopener'
      a.download = info.apkName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch (err) {
    console.error('[updater] download error:', err)
    throw err
  }
}

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (!bytes) return '未知'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// 格式化发布时间
export function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}
