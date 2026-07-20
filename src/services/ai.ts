// DeepSeek V4-Flash API 封装
// 文档：https://api-docs.deepseek.com （OpenAI 兼容格式）
// 旧模型名 deepseek-chat / deepseek-reasoner 将于 2026-07-24 下线，统一改用 deepseek-v4-flash
//
// 注：Capacitor 启用 CapacitorHttp 原生代理后，fetch 的 response.body 不再是 ReadableStream，
// 因此本文件采用「非流式请求 + 客户端模拟打字机」方案，跨平台表现一致。

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

export interface InterpretInput {
  question: string
  options: string[]
  answer: string // 单选："A"/"B" 等单字母；多选："ABC" 等字母组合
  explanation: string
  type?: 'single' | 'multi' // 缺省 single
  userAnswer?: string // 用户作答（用于让 AI 知道用户错在哪）
  isCorrect?: boolean
  licenseName?: string // 执照名（用于背景知识定位章节）
}

function cleanOpt(opt: string): string {
  return opt.replace(/^[A-D][.、)]\s*/, '')
}

function lettersToText(letters: string, options: string[]): string {
  return letters.toUpperCase().split('').filter((c) => /[A-D]/.test(c))
    .map((l) => {
      const idx = l.charCodeAt(0) - 65
      const opt = options[idx]
      return opt ? `${l}. ${cleanOpt(opt)}` : l
    })
    .filter(Boolean)
    .join('、')
}

/**
 * 解读题目：题型提示 + 解题思路 + 相关章节背景知识
 * 内部一次性请求 DeepSeek，然后通过 onChunk 回调模拟打字机效果逐字返回
 */
export async function streamInterpretQuestion(
  input: InterpretInput,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!apiKey) {
    onChunk('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再启用 AI 解读。')
    return
  }

  const isMulti = (input.type === 'multi') || input.answer.length > 1
  const typeLabel = isMulti ? '多选题' : '单选题'

  const correctLetters = input.answer.toUpperCase().replace(/[^A-D]/g, '')
  const ansTexts = lettersToText(correctLetters, input.options)
  const optionsBlock = input.options
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${cleanOpt(o)}`)
    .join('\n')

  const userAnsText = input.userAnswer
    ? lettersToText(input.userAnswer, input.options)
    : '未作答'

  const systemPrompt = `你是「考证星球」APP 的 AI 解读助手，专门为考证学员讲解题目。
要求：
1. 第一行用「## 题型」明确告知本题是单选题还是多选题；
2. 接着用「## 解题思路」分步骤说明每个选项对/错的原因，重点讲为什么正确答案对、干扰项错在哪；
3. 然后用「## 背景知识」补讲本题涉及的章节核心知识点（如果用户没看过教材，要让他读完就能理解这道题背后的考点），3-6 句话即可；
4. 最后用「## 易错提醒」一句话提示考生此类题最容易踩的坑；
5. 全程使用中文，语言通俗、像学长讲解，不要出现「作为 AI」之类的套话；
6. 如果用户答错，在「解题思路」中点出他错在哪。`

  const userPrompt = `【执照类别】${input.licenseName || '通用'}
【题型】${typeLabel}
【题目】${input.question}
【选项】
${optionsBlock}
【正确答案】${ansTexts || input.answer}
【用户作答】${userAnsText}（${input.isCorrect ? '正确' : '错误'}）
【官方解析】${input.explanation || '（无）'}

请按系统提示的格式输出。`

  let fullText = ''
  let errMsg = ''

  try {
    const resp = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.6,
        max_tokens: 900,
        // 关闭思考模式：DeepSeek V4-Flash 默认开启思考，会把思考过程放到 reasoning_content
        // 用户不需要看到思考过程，关闭后直接返回最终答案到 content
        thinking: { type: 'disabled' },
      }),
      signal,
    })

    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try {
        const errBody = await resp.json()
        msg = errBody?.error?.message || errBody?.message || msg
      } catch { /* ignore */ }
      if (resp.status === 401) errMsg = '⚠️ API Key 无效或已过期，请到「设置」重新填写 DeepSeek API Key。'
      else if (resp.status === 429) errMsg = '⚠️ 请求过于频繁或额度已用尽，请稍后再试。'
      else errMsg = `⚠️ 解读失败：${msg}`
    } else {
      const data = await resp.json()
      fullText = data?.choices?.[0]?.message?.content || ''
      if (!fullText) errMsg = '⚠️ AI 未返回内容，请稍后重试。'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    errMsg = `⚠️ 网络请求失败：${(err as Error).message}`
  }

  if (errMsg) {
    onChunk(errMsg)
    return
  }

  // 模拟流式打字机效果：按字符块逐步输出
  await simulateTyping(fullText, onChunk, signal)
}

/**
 * 把完整文本按 ~3 个字符一组、每 16ms 一组逐步输出
 * 支持 AbortSignal 中断
 */
async function simulateTyping(
  text: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const chunkSize = 3
  const intervalMs = 16
  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) return
    // 切后台时 WebView 会冻结 setTimeout，回来时挂起的定时器会连续 resolve，
    // 导致 setText 被高频调用引发渲染风暴。检测到页面不可见时立即一次性输出剩余文本。
    if (typeof document !== 'undefined' && document.hidden) {
      onChunk(text.slice(i))
      return
    }
    onChunk(text.slice(i, i + chunkSize))
    if (i + chunkSize < text.length) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, intervalMs)
        // 支持中断时立即 resolve
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            resolve()
          }, { once: true })
        }
      })
    }
  }
}

/**
 * 测试 API Key 是否可用（非流式轻量请求）
 */
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey) return { ok: false, message: 'API Key 不能为空' }
  try {
    const resp = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: '你好，请回复「ok」' }],
        max_tokens: 8,
        stream: false,
        thinking: { type: 'disabled' },
      }),
    })
    if (resp.ok) {
      return { ok: true, message: '连接成功 · DeepSeek V4-Flash 已就绪' }
    }
    if (resp.status === 401) return { ok: false, message: 'API Key 无效或已过期' }
    if (resp.status === 429) return { ok: false, message: '请求过于频繁，稍后再试' }
    let msg = `HTTP ${resp.status}`
    try {
      const errBody = await resp.json()
      msg = errBody?.error?.message || msg
    } catch { /* noop */ }
    return { ok: false, message: msg }
  } catch (err) {
    return { ok: false, message: `网络错误：${(err as Error).message}` }
  }
}
