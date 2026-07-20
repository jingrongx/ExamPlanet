import { motion } from 'framer-motion'
import { Modal, NeonButton, useToast } from './index'
import { playButton } from '../../engine/audio'
import { renderMarkdown } from '../../engine/markdown'
import { downloadApk, formatSize, formatDate, type UpdateInfo } from '../../services/updater'

interface UpdateModalProps {
  open: boolean
  onClose: () => void
  info: UpdateInfo | null
  checking?: boolean
}

export function UpdateModal({ open, onClose, info, checking }: UpdateModalProps) {
  const toast = useToast()

  const handleDownload = async () => {
    if (!info) return
    playButton()
    try {
      await downloadApk(info)
      toast('已打开系统浏览器下载，下载完成后请点击通知栏安装', 'success')
      // 给用户一个查看下载进度的时机，不立即关闭 Modal
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      toast(`下载失败：${(err as Error).message}`, 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="发现新版本">
      <div className="py-2">
        {checking ? (
          <div className="text-center py-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="text-5xl mb-3 inline-block"
            >
              🛰️
            </motion.div>
            <div className="text-sm text-stardust/70 animate-pulse">正在检查更新…</div>
          </div>
        ) : info ? (
          <>
            <div className="text-center mb-3">
              <div className="text-5xl mb-2">🚀</div>
              <div className="font-display font-bold text-lg neon-text-cyan">
                {info.releaseName}
              </div>
              <div className="text-[11px] font-mono text-stardust/50 mt-1">
                v{info.currentVersion} → <span className="text-neon-cyan">v{info.latestVersion}</span>
              </div>
              {info.publishedAt && (
                <div className="text-[10px] text-stardust/40 mt-1">
                  发布于 {formatDate(info.publishedAt)}
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-3 max-h-64 overflow-y-auto mb-3">
              <div className="text-[10px] font-tech font-bold text-neon-gold mb-1.5">📝 更新内容</div>
              <div className="text-xs text-stardust/85 leading-relaxed break-words">
                {renderMarkdown(info.changelog)}
              </div>
            </div>

            {info.apkSize > 0 && (
              <div className="text-[10px] text-stardust/40 mb-3 text-center">
                安装包大小：{formatSize(info.apkSize)} · 通过 ghproxy 加速下载
              </div>
            )}

            <div className="flex gap-2">
              <NeonButton variant="ghost" onClick={() => { playButton(); onClose() }} className="flex-1 text-xs">
                稍后再说
              </NeonButton>
              <NeonButton variant="primary" onClick={handleDownload} className="flex-1 text-xs">
                ⬇️ 立即更新
              </NeonButton>
            </div>

            <div className="text-[10px] text-stardust/40 mt-2 leading-relaxed text-center">
              点击「立即更新」会跳转到系统浏览器下载 APK，下载完成后点击通知栏的安装提示即可。
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✨</div>
            <div className="text-sm text-stardust/70">检查更新失败</div>
            <div className="text-[10px] text-stardust/40 mt-1">请稍后重试或到 GitHub Release 页面手动下载</div>
            <NeonButton variant="ghost" onClick={() => { playButton(); onClose() }} className="mt-3 text-xs">
              关闭
            </NeonButton>
          </div>
        )}
      </div>
    </Modal>
  )
}
