// 生成 APP 图标和 Splash 启动画面
// 使用 @resvg/resvg-js 将 SVG 渲染为 PNG，输出到 android/app/src/main/res/
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RES_DIR = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res')

// ===== 图标 SVG（512x512，自适应图标前景，内容居中占 70%）=====
const iconSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1a1a4e"/>
      <stop offset="60%" stop-color="#0a0a2e"/>
      <stop offset="100%" stop-color="#050514"/>
    </radialGradient>
    <radialGradient id="planet" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="50%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- 背景 -->
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- 远处星点 -->
  <circle cx="80" cy="100" r="2" fill="#ffffff" opacity="0.8"/>
  <circle cx="430" cy="80" r="1.5" fill="#ffffff" opacity="0.6"/>
  <circle cx="440" cy="420" r="2" fill="#00f5ff" opacity="0.7"/>
  <circle cx="70" cy="400" r="1.8" fill="#ffffff" opacity="0.5"/>
  <circle cx="100" cy="280" r="1.2" fill="#ffffff" opacity="0.4"/>
  <circle cx="400" cy="250" r="1.5" fill="#ff2e88" opacity="0.6"/>
  <!-- 外圈轨道（青色霓虹） -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="#00f5ff" stroke-width="6" opacity="0.4" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#00f5ff" stroke-width="3" opacity="0.9"/>
  <!-- 中圈轨道（粉色） -->
  <ellipse cx="256" cy="256" rx="140" ry="50" fill="none" stroke="#ff2e88" stroke-width="3" opacity="0.7" transform="rotate(-20 256 256)"/>
  <!-- 中央星球 -->
  <circle cx="256" cy="256" r="90" fill="url(#planet)" filter="url(#glow)"/>
  <!-- 星球高光 -->
  <ellipse cx="226" cy="226" rx="30" ry="20" fill="#ffffff" opacity="0.5"/>
  <!-- 星球环（土星感） -->
  <ellipse cx="256" cy="256" rx="120" ry="35" fill="none" stroke="#00f5ff" stroke-width="4" opacity="0.8" transform="rotate(-15 256 256)"/>
  <ellipse cx="256" cy="256" rx="120" ry="35" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.3" transform="rotate(-15 256 256)"/>
</svg>`

// ===== Splash SVG（1242x2688 iPhone 尺寸，足够覆盖安卓各分辨率）=====
const splashSvg = (w, h) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#1a1a4e"/>
      <stop offset="50%" stop-color="#0a0a2e"/>
      <stop offset="100%" stop-color="#050514"/>
    </radialGradient>
    <radialGradient id="planet" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="50%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </radialGradient>
    <linearGradient id="title" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f5ff"/>
      <stop offset="50%" stop-color="#ff2e88"/>
      <stop offset="100%" stop-color="#ffd700"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="textglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- 背景 -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <!-- 星点 -->
  ${Array.from({length: 60}, () => {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = Math.random() * 1.5 + 0.5
    const op = Math.random() * 0.6 + 0.3
    const colors = ['#ffffff', '#ffffff', '#ffffff', '#00f5ff', '#ff2e88', '#ffd700']
    const c = colors[Math.floor(Math.random() * colors.length)]
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" opacity="${op.toFixed(2)}"/>`
  }).join('')}
  <!-- 中央星球 -->
  <g transform="translate(${w/2}, ${h/2 - 80})">
    <!-- 外圈轨道 -->
    <circle cx="0" cy="0" r="180" fill="none" stroke="#00f5ff" stroke-width="4" opacity="0.3" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="180" fill="none" stroke="#00f5ff" stroke-width="2" opacity="0.8"/>
    <!-- 中圈椭圆 -->
    <ellipse cx="0" cy="0" rx="140" ry="40" fill="none" stroke="#ff2e88" stroke-width="3" opacity="0.6" transform="rotate(-20)"/>
    <!-- 星球本体 -->
    <circle cx="0" cy="0" r="100" fill="url(#planet)" filter="url(#glow)"/>
    <ellipse cx="-30" cy="-30" rx="35" ry="22" fill="#ffffff" opacity="0.5"/>
    <!-- 星球环 -->
    <ellipse cx="0" cy="0" rx="130" ry="38" fill="none" stroke="#00f5ff" stroke-width="4" opacity="0.8" transform="rotate(-15)"/>
    <ellipse cx="0" cy="0" rx="130" ry="38" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.3" transform="rotate(-15)"/>
  </g>
  <!-- 标题 -->
  <text x="${w/2}" y="${h/2 + 130}" text-anchor="middle"
        font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif"
        font-size="72" font-weight="900" fill="url(#title)" filter="url(#textglow)">考证星球</text>
  <text x="${w/2}" y="${h/2 + 180}" text-anchor="middle"
        font-family="'Consolas','Courier New',monospace"
        font-size="22" font-weight="500" fill="#00f5ff" opacity="0.8" letter-spacing="6">CERT · PLANET</text>
  <text x="${w/2}" y="${h/2 + 220}" text-anchor="middle"
        font-family="'Microsoft YaHei',sans-serif"
        font-size="18" fill="#ffffff" opacity="0.5" letter-spacing="2">开启你的太空考证之旅</text>
</svg>`

// ===== 渲染并写入文件 =====
function renderPng(svgString, width, height, dstPath) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  })
  const png = resvg.render().asPng()
  mkdirSync(dirname(dstPath), { recursive: true })
  writeFileSync(dstPath, png)
  console.log(`  ✓ ${dstPath}`)
}

// ===== 1. 图标 =====
console.log('Generating icons...')
const iconSizes = {
  'mipmap-mdpi':    { size: 48,  fg: 108 },
  'mipmap-hdpi':    { size: 72,  fg: 162 },
  'mipmap-xhdpi':   { size: 96,  fg: 216 },
  'mipmap-xxhdpi':  { size: 144, fg: 324 },
  'mipmap-xxxhdpi': { size: 192, fg: 432 },
}

// 先生成高清原图（512x512）
const srcSvg = iconSvg(512)
for (const [dir, { size, fg }] of Object.entries(iconSizes)) {
  // ic_launcher.png
  renderPng(srcSvg, size, size, join(RES_DIR, dir, 'ic_launcher.png'))
  // ic_launcher_round.png
  renderPng(srcSvg, size, size, join(RES_DIR, dir, 'ic_launcher_round.png'))
  // ic_launcher_foreground.png
  renderPng(srcSvg, fg, fg, join(RES_DIR, dir, 'ic_launcher_foreground.png'))
}

// 2. 生成 adaptive icon 的 background（深紫色纯色）
const bgSvg = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">#0a0a2e</color>
</resources>`
// 这个是 values 资源，单独写

// ===== 3. Splash =====
console.log('Generating splash...')
const splashSizes = {
  'drawable-mdpi':        [240, 320],
  'drawable-hdpi':        [480, 800],
  'drawable-xhdpi':       [720, 1280],
  'drawable-xxhdpi':      [1080, 1920],
  'drawable-xxxhdpi':     [1440, 2560],
  'drawable-port-mdpi':   [240, 320],
  'drawable-port-hdpi':   [480, 800],
  'drawable-port-xhdpi':  [720, 1280],
  'drawable-port-xxhdpi': [1080, 1920],
  'drawable-port-xxxhdpi':[1440, 2560],
  'drawable-land-mdpi':   [320, 240],
  'drawable-land-hdpi':   [800, 480],
  'drawable-land-xhdpi':  [1280, 720],
  'drawable-land-xxhdpi': [1920, 1080],
  'drawable-land-xxxhdpi':[2560, 1440],
  'drawable':             [1080, 1920],
}

for (const [dir, [w, h]] of Object.entries(splashSizes)) {
  renderPng(splashSvg(w, h), w, h, join(RES_DIR, dir, 'splash.png'))
}

console.log('\n✓ All resources generated')
