// 生成 Android APP 图标和启动闪屏的所有尺寸 PNG
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const ICON_SVG = readFileSync(join(ROOT, 'assets/icon.svg'), 'utf-8')
const SPLASH_SVG = readFileSync(join(ROOT, 'assets/splash.svg'), 'utf-8')

// Android 图标尺寸（dpi -> px）
const ICON_SIZES = [
  { size: 48, dir: 'mipmap-mdpi' },
  { size: 72, dir: 'mipmap-hdpi' },
  { size: 96, dir: 'mipmap-xhdpi' },
  { size: 144, dir: 'mipmap-xxhdpi' },
  { size: 192, dir: 'mipmap-xxxhdpi' },
]

// 启动闪屏尺寸（按 drawable 目录）
const SPLASH_SIZES = [
  { w: 480, h: 800, dir: 'drawable-mdpi' },
  { w: 720, h: 1280, dir: 'drawable-hdpi' },
  { w: 960, h: 1600, dir: 'drawable-xhdpi' },
  { w: 1280, h: 1920, dir: 'drawable-xxhdpi' },
  { w: 1440, h: 2560, dir: 'drawable-xxxhdpi' },
]

function renderPng(svg, w, h) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
    background: 'rgba(0,0,0,0)',
  })
  const rendered = resvg.render()
  return rendered.asPng()
}

// 生成图标
console.log('🎨 生成 APP 图标...')
for (const { size, dir } of ICON_SIZES) {
  const outDir = join(ROOT, `android/app/src/main/res/${dir}`)
  mkdirSync(outDir, { recursive: true })
  const png = renderPng(ICON_SVG, size, size)
  writeFileSync(join(outDir, 'ic_launcher.png'), png)
  writeFileSync(join(outDir, 'ic_launcher_round.png'), png)
  console.log(`  ✓ ${dir}/ic_launcher.png (${size}x${size})`)
}

// 生成启动闪屏
console.log('🚀 生成启动闪屏...')
for (const { w, h, dir } of SPLASH_SIZES) {
  const outDir = join(ROOT, `android/app/src/main/res/${dir}`)
  mkdirSync(outDir, { recursive: true })
  const png = renderPng(SPLASH_SVG, w, h)
  writeFileSync(join(outDir, 'splash.png'), png)
  console.log(`  ✓ ${dir}/splash.png (${w}x${h})`)
}

// 生成 PWA 图标（用于 manifest）
console.log('🌐 生成 PWA 图标...')
const pwaDir = join(ROOT, 'public/icons')
mkdirSync(pwaDir, { recursive: true })
writeFileSync(join(pwaDir, 'icon-192.png'), renderPng(ICON_SVG, 192, 192))
writeFileSync(join(pwaDir, 'icon-512.png'), renderPng(ICON_SVG, 512, 512))
console.log('  ✓ public/icons/icon-192.png')
console.log('  ✓ public/icons/icon-512.png')

console.log('\n✅ 所有图标和闪屏生成完毕')
