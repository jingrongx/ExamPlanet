// AI 记忆口诀生成器（模板匹配 + 关键词提取）
const MNEMONIC_TEMPLATES = {
  谐音: [
    (kw: string) => `「${kw}」谐音记忆：将"${kw}"想象成一个生动的画面，越离谱越好记。`,
    (kw: string) => `把"${kw}"读出来：${kw.split('').map((c) => c).join('→')}，每个字联想一个图像。`,
  ],
  场景: [
    (kw: string) => `场景记忆：想象你站在考试现场，看到题目"${kw}"时脑海里浮现的画面。`,
    (kw: string) => `故事联想法：把"${kw}"编进一个有起承转合的小故事，比如它发生在机场/电台/办公室。`,
  ],
  口诀: [
    (kw: string) => `顺口溜：${kw}牢记心，考试不丢分；理解加记忆，轻松拿满分。`,
    (kw: string) => `节奏口诀：${kw}——快读三遍，闭眼复述，再读三遍，永久记忆。`,
  ],
  联想: [
    (kw: string) => `公式联想：${kw} = 已知概念 + 新线索 → 答案。把陌生信息锚定到熟悉知识上。`,
    (kw: string) => `对比记忆：把"${kw}"和它的对立面/相似面一起记，区分清楚不易混淆。`,
  ],
}

// 关键词提取（简单版：取题目中的核心名词/动词）
function extractKeywords(text: string): string[] {
  // 去除常见疑问词、虚词
  const stopWords = new Set([
    '下列', '下列哪', '关于', '下列关于', '以下', '以下哪', '下列选项', '正确',
    '错误', '不', '是', '为', '属于', '不属于', '包括', '不包括', '表示', '指',
    '是指', '称为', '称为', '含义', '含义是', '核心', '主要', '最', '通常',
    '一般', '应当', '应该', '必须', '可以', '可能', '与', '和', '的', '了',
    '在', '中', '上', '下', '对', '为', '由', '从', '向', '到', '将', '被',
  ])

  // 简单提取 2-4 字中文词
  const cleaned = text.replace(/[（）《》、，。；：""''（）()\.\?\?！!]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2 && t.length <= 8 && !stopWords.has(t))
  // 取前 3 个
  return tokens.slice(0, 3)
}

export function generateMnemonic(question: string, answer: string, explanation: string): string[] {
  const keywords = extractKeywords(question + ' ' + answer)
  if (keywords.length === 0) {
    keywords.push(question.substring(0, 8))
  }
  const mainKeyword = keywords[0]
  const types = Object.keys(MNEMONIC_TEMPLATES) as (keyof typeof MNEMONIC_TEMPLATES)[]
  const result: string[] = []
  for (const type of types) {
    const templates = MNEMONIC_TEMPLATES[type]
    const tmpl = templates[Math.floor(Math.random() * templates.length)]
    result.push(`【${type}】${tmpl(mainKeyword)}`)
  }
  return result
}

// 内置部分经典口诀（针对高频题）
export const BUILTIN_MNEMONICS: Record<string, string> = {
  'UAV-020': '伯努利伯伯流得快，压力大就压力大（流速大压强小，流速小压强大）',
  'UAV-021': '失速=超临界迎角，记住"过犹不及"——迎角过大反而升力崩塌',
  'PPL-009': '机翼像翅膀，上面快下面慢，压差推上天（伯努利）',
  'PPL-010': '失速不在速度在迎角——"角过则失"',
  'PPL-014': '60度坡度2倍载荷：cos(60)=0.5，1/0.5=2',
  'HAM-015': '73 = Best Regards，"七三"= 致敬收尾',
  'HAM-018': '光速30万公里/秒 = 3×10^8 m/s，"三亿"米每秒',
  'HAM-019': '波长=300/频率(MHz)，单位米——"300除一除"',
  'ECO-016': 'MR=MC，利润最大化黄金等式——"边际相等"',
  'ECO-029': '消费税+关税=中央税；增值税/所得税=共享税',
  'ECO-031': 'M0=现金；M1=M0+活期；M2=M1+定期+个人存款——"层层加"',
  'ECO-046': '资产=负债+所有者权益，"借方=贷方"——会计恒等式',
}

export function getMnemonic(questionId: string): string | undefined {
  return BUILTIN_MNEMONICS[questionId]
}
