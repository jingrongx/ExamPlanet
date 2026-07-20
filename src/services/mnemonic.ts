// AI 记忆口诀生成（DeepSeek V4-Flash）
// 与 ai.ts 的解读服务独立，prompt 专注于"把考点变成可背诵的口诀"
// 同样采用「非流式请求 + 客户端模拟打字机」方案

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

export interface MnemonicInput {
  question: string
  options: string[]
  answer: string // 单选："A" 等；多选："ABC" 等
  explanation: string
  type?: 'single' | 'multi'
  licenseName?: string
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
 * 生成 4 段记忆口诀：谐音对照 / 场景动作 / 押韵口诀 / 关系公式
 * 一次性请求 DeepSeek，再通过 onChunk 回调模拟打字机
 */
export async function streamMnemonic(
  input: MnemonicInput,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!apiKey) {
    onChunk('⚠️ 未配置 DeepSeek API Key，请在「设置」中填写后再生成 AI 口诀。')
    return
  }

  const isMulti = (input.type === 'multi') || input.answer.length > 1
  const typeLabel = isMulti ? '多选题' : '单选题'

  const correctLetters = input.answer.toUpperCase().replace(/[^A-D]/g, '')
  const ansTexts = lettersToText(correctLetters, input.options)
  const optionsBlock = input.options
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${cleanOpt(o)}`)
    .join('\n')

  const systemPrompt = `你是「考证星球」APP 的记忆口诀大师，专门为考证学员把枯燥考点变成记得住、背得出的口诀。

输出格式（严格遵守，共 4 段，每段必须有具体可背诵的内容）：

## 谐音对照
把答案核心字（2-4 字）编成一句贴近生活的谐音短句。谐音要有趣、有画面感，让人过目不忘。
格式：原字 → 谐音句 —— 一句话点明"原字怎么记成谐音"。
示例（伯努利原理）：伯努利 → 驳你来 —— "流速大的地方压力小，像有人'驳'（顶）你，你就被吸过去"

## 场景动作
用 1-2 句话描述一个具体的生活场景或动作，把答案和场景绑定。场景要真实、动作要具体，让学员脑中有画面。
格式：场景 + 动作 + 答案关联。
示例（需求弹性）：菜市场买猪肉，猪肉一涨价大妈就不买了——"价格上、需求下"，这就是需求价格弹性。

## 押韵口诀
编 1-2 句押韵的口诀（七言或五言优先），要自然押韵，内容必须涵盖题干关键词和答案核心。
格式：直接给口诀句。
示例（M0/M1/M2）：M0 现金手里攥，M1 活期加上算，M2 定期也归入，层层叠加不混乱。

## 关系公式
提炼题目中的核心关系（正比/反比/等于/大于/小于/顺序/分类/数值），用 ↑↓→ = > < 等符号给出记忆公式。如果没有数值关系，就提炼逻辑链条。
格式：公式或逻辑链 + 一句话说明。
示例（MR=MC）：MR = MC —— 边际收益等于边际成本，多卖一单位的钱=多花一单位的钱，这就是利润最大化点。

要求：
1. 全程中文，通俗易记，像学长口诀；
2. 不要出现"作为 AI""好的""以下是"等套话，直接输出 4 段；
3. 4 段必须有具体内容，不允许说"此题不适合谐音"之类——必须想出谐音；
4. 每段控制在 2-3 句以内，简洁有力；
5. 必须针对本题的答案和解析生成，不要泛泛而谈。`

  const userPrompt = `【执照类别】${input.licenseName || '通用'}
【题型】${typeLabel}
【题目】${input.question}
【选项】
${optionsBlock}
【正确答案】${ansTexts || input.answer}
【官方解析】${input.explanation || '（无）'}

请按系统提示的格式输出 4 段记忆口诀，每段都要有针对本题的具体内容。`

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
        temperature: 0.8,
        max_tokens: 1500,
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
      else errMsg = `⚠️ 口诀生成失败：${msg}`
      console.error('[mnemonic] HTTP error:', resp.status, msg)
    } else {
      const data = await resp.json()
      const choice = data?.choices?.[0]
      const msg0 = choice?.message
      // DeepSeek 偶尔会把内容放在 reasoning_content；content 可能返回 null/空字符串
      const content: string = msg0?.content ?? ''
      const reasoning: string = msg0?.reasoning_content ?? ''
      const finishReason: string = choice?.finish_reason ?? ''
      console.error('[mnemonic] response meta:', JSON.stringify({
        hasContent: !!content,
        contentLen: content.length,
        hasReasoning: !!reasoning,
        reasoningLen: reasoning.length,
        finishReason,
        model: data?.model,
        usage: data?.usage,
      }))
      fullText = content || reasoning || ''
      if (!fullText) {
        console.error('[mnemonic] empty content, raw data:', JSON.stringify(data).slice(0, 800))
        errMsg = finishReason === 'length'
          ? '⚠️ 输出长度超限被截断，请稍后重试。'
          : '⚠️ AI 未返回内容，请稍后重试。'
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    errMsg = `⚠️ 网络请求失败：${(err as Error).message}`
    console.error('[mnemonic] fetch error:', err)
  }

  if (errMsg) {
    onChunk(errMsg)
    return
  }

  await simulateTyping(fullText, onChunk, signal)
}

async function simulateTyping(
  text: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const chunkSize = 3
  const intervalMs = 16
  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) return
    onChunk(text.slice(i, i + chunkSize))
    if (i + chunkSize < text.length) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, intervalMs)
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
