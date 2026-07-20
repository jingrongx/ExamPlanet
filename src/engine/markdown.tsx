// 轻量 Markdown 渲染器（React 友好，无外部依赖）
// 支持：
// - 标题 # ## ### ####
// - 加粗 **text** / __text__
// - 斜体 *text* / _text_
// - 删除线 ~~text~~
// - 行内代码 `code`
// - 代码块 ```lang\ncode\n```
// - 无序列表 - / * / + 开头
// - 有序列表 1. 2.
// - 引用 > text
// - 分割线 --- / ***
// - 链接 [text](url)
// - 段落、换行
//
// 用于：更新日志、AI 解读、记忆口诀展示
// 渲染为 React 节点数组，调用方包在 <div className="prose"> 中

import { Fragment, type ReactNode } from 'react'

interface MdBlock {
  type: 'code' | 'heading' | 'hr' | 'quote' | 'ul' | 'ol' | 'p'
  level?: number // heading 1-4
  lang?: string
  content?: string // code/raw content
  items?: string[] // list items
  text?: string // paragraph/quote text
}

// 把原始 markdown 字符串拆成块
function parseBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束的 ```
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') })
      continue
    }

    // 空行
    if (!line.trim()) {
      i++
      continue
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      i++
      continue
    }

    // 引用
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n') })
      continue
    }

    // 无序列表
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, '').trim())
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, '').trim())
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // 段落：连续非空非特殊行
    const paraLines: string[] = []
    while (
      i < lines.length
      && lines[i].trim()
      && !lines[i].startsWith('```')
      && !lines[i].startsWith('#')
      && !lines[i].startsWith('>')
      && !/^[-*+]\s+/.test(lines[i])
      && !/^\d+\.\s+/.test(lines[i])
      && !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'p', text: paraLines.join(' ') })
    }
  }
  return blocks
}

// 转义 HTML 特殊字符
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 渲染行内 markdown（加粗/斜体/删除线/代码/链接）为 React 节点
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let key = 0

  // 正则匹配所有行内元素
  const patterns: Array<{ regex: RegExp; render: (m: RegExpExecArray) => ReactNode }> = [
    {
      // 链接 [text](url)
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-cyan underline hover:text-neon-pink"
        >
          {m[1]}
        </a>
      ),
    },
    {
      // 加粗 **text** 或 __text__
      regex: /(\*\*([^*]+)\*\*|__([^_]+)__)/,
      render: (m) => (
        <strong className="font-bold text-stardust">
          {m[2] || m[3]}
        </strong>
      ),
    },
    {
      // 行内代码 `code`
      regex: /`([^`]+)`/,
      render: (m) => (
        <code className="px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan font-mono text-[0.85em]">
          {m[1]}
        </code>
      ),
    },
    {
      // 删除线 ~~text~~
      regex: /~~([^~]+)~~/,
      render: (m) => (
        <del className="text-stardust/50">{m[1]}</del>
      ),
    },
    {
      // 斜体 *text* 或 _text_（避免和加粗冲突，要求紧邻非 * 字符）
      regex: /(?:^|[^*])\*([^*\n]+)\*(?:[^*]|$)/,
      render: (m) => (
        <em className="italic text-stardust/90">{m[1]}</em>
      ),
    },
  ]

  while (rest.length > 0) {
    let earliestIdx = -1
    let earliestMatch: RegExpExecArray | null = null
    let earliestRender: ((m: RegExpExecArray) => ReactNode) | null = null

    for (const p of patterns) {
      const m = p.regex.exec(rest)
      if (m && (earliestIdx === -1 || m.index < earliestIdx)) {
        earliestIdx = m.index
        earliestMatch = m
        earliestRender = p.render
      }
    }

    if (!earliestMatch || !earliestRender) {
      // 没有更多匹配，剩余作为纯文本
      nodes.push(<Fragment key={`${keyPrefix}-${key++}`}>{rest}</Fragment>)
      break
    }

    // 处理斜体正则可能包含前置字符的问题
    let prefixText = rest.slice(0, earliestMatch.index)
    let matchText = earliestMatch[0]
    if (earliestMatch[0].startsWith('*') === false && earliestMatch[0].match(/^\*/)) {
      // 不处理
    }
    // 对于斜体：正则可能捕获了前置字符，需要保留
    const italicMatch = earliestMatch[0].match(/(?:^|[^*])\*([^*\n]+)\*(?:[^*]|$)/)
    if (italicMatch && earliestMatch[0] === italicMatch[0]) {
      // 把前置/后置字符留在 prefix/suffix
      const fullText = earliestMatch[0]
      const startChar = fullText[0]
      const endChar = fullText[fullText.length - 1]
      if (startChar !== '*') {
        prefixText += startChar
        matchText = fullText.slice(1)
      }
      if (endChar !== '*') {
        matchText = matchText.slice(0, -1)
        rest = endChar + rest.slice(earliestMatch.index + fullText.length)
      } else {
        rest = rest.slice(earliestMatch.index + fullText.length)
      }
    } else {
      rest = rest.slice(earliestMatch.index + earliestMatch[0].length)
    }

    if (prefixText) {
      nodes.push(<Fragment key={`${keyPrefix}-${key++}`}>{prefixText}</Fragment>)
    }
    nodes.push(<Fragment key={`${keyPrefix}-${key++}`}>{earliestRender(earliestMatch)}</Fragment>)
  }

  return nodes
}

// 渲染一个块
function renderBlock(block: MdBlock, idx: number): ReactNode {
  switch (block.type) {
    case 'code':
      return (
        <pre
          key={idx}
          className="my-2 p-3 rounded-xl bg-black/40 border border-neon-cyan/20 overflow-x-auto"
        >
          <code className="text-xs font-mono text-neon-cyan/90 leading-relaxed whitespace-pre">
            {block.content || ''}
          </code>
        </pre>
      )
    case 'heading': {
      const level = block.level || 1
      const sizes = ['text-base', 'text-sm', 'text-sm', 'text-xs']
      const cls = sizes[Math.min(level - 1, 3)]
      return (
        <div
          key={idx}
          className={`mt-3 first:mt-0 font-display font-bold ${cls} neon-text-gold flex items-center gap-1.5`}
        >
          <span>✨</span>
          <span>{block.text}</span>
        </div>
      )
    }
    case 'hr':
      return <hr key={idx} className="my-3 border-white/10" />
    case 'quote':
      return (
        <blockquote
          key={idx}
          className="my-2 pl-3 py-1 border-l-2 border-neon-cyan/40 text-stardust/80 italic"
        >
          {renderInline(block.text || '', `q-${idx}`)}
        </blockquote>
      )
    case 'ul':
      return (
        <ul key={idx} className="my-1.5 pl-5 space-y-1 list-disc list-outside marker:text-neon-cyan/60">
          {block.items?.map((it, j) => (
            <li key={j} className="text-sm text-stardust/85 leading-relaxed">
              {renderInline(it, `ul-${idx}-${j}`)}
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={idx} className="my-1.5 pl-5 space-y-1 list-decimal list-outside marker:text-neon-cyan/60">
          {block.items?.map((it, j) => (
            <li key={j} className="text-sm text-stardust/85 leading-relaxed">
              {renderInline(it, `ol-${idx}-${j}`)}
            </li>
          ))}
        </ol>
      )
    case 'p':
    default:
      return (
        <p key={idx} className="my-1 text-sm text-stardust/85 leading-relaxed">
          {renderInline(block.text || '', `p-${idx}`)}
        </p>
      )
  }
}

// 主入口：把 markdown 字符串渲染为 React 节点
export function renderMarkdown(md: string): ReactNode {
  if (!md) return null
  const blocks = parseBlocks(md)
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>
}

// 把 markdown 中的符号过滤掉，得到纯文本（用于 TTS 朗读）
// - 去掉 #、*、_、`、>、-、+ 等标记符
// - 去掉链接的 url 只保留文字
// - 保留实际内容
export function stripMarkdown(md: string): string {
  if (!md) return ''
  let s = md
  // 代码块 → 保留内容
  s = s.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => code)
  // 行内代码 → 保留内容
  s = s.replace(/`([^`]+)`/g, '$1')
  // 链接 [text](url) → text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  // 加粗 **text** / __text__ → text
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  // 删除线 ~~text~~ → text
  s = s.replace(/~~([^~]+)~~/g, '$1')
  // 斜体 *text* / _text_ → text
  s = s.replace(/\*([^*\n]+)\*/g, '$1')
  s = s.replace(/_([^_\n]+)_/g, '$1')
  // 标题 # → 去掉
  s = s.replace(/^#{1,4}\s+/gm, '')
  // 引用 > → 去掉
  s = s.replace(/^>\s?/gm, '')
  // 无序列表标记 - * + → 去掉
  s = s.replace(/^[-*+]\s+/gm, '')
  // 有序列表 1. → 去掉
  s = s.replace(/^\d+\.\s+/gm, '')
  // 分割线 --- *** ___ → 去掉
  s = s.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
  // 多余的连续空白合并
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

// 用于 Settings 等场景的简单 HTML 转义（如安全显示 API Key 等）
export { escapeHtml }
