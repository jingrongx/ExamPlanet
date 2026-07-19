// AI 记忆口诀生成器
// 直接给出可背诵的记忆内容，而非"应该这样做"的指导语

// 从答案中提取核心内容（去除 A. / B. 等前缀）
function cleanAnswer(answer: string): string {
  return answer.replace(/^[A-D][.、)]\s*/, '').trim()
}

// 从文本中提取核心实义词（2-6 字中文片段）
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    '下列', '关于', '以下', '选项', '正确', '错误', '属于', '包括', '表示',
    '是指', '称为', '含义', '核心', '主要', '通常', '一般', '应当', '必须',
    '可以', '可能', '如果', '因此', '因为', '所以', '这个', '那个',
    '的', '了', '在', '中', '上', '下', '和', '与', '或', '及',
    '是', '为', '不', '无', '有', '该', '其', '此', '这', '那',
  ])
  const cleaned = text.replace(/[（）《》、，。；：""''（）()\.\?\?！!，,；;：:0-9\s]/g, ' ')
  const tokens = cleaned.split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= 8 && !stopWords.has(t) && /^[\u4e00-\u9fa5]+$/.test(t))
  return [...new Set(tokens)].slice(0, 5)
}

// 从解析中提取核心关系/结论
function extractCoreLogic(explanation: string): string {
  if (!explanation) return ''
  // 去掉前缀因果词
  let s = explanation.replace(/^(这是|因为|由于|根据|按照|说明|表示)\s*/g, '').trim()
  // 按句号/分号切，取第一句
  const sentences = s.split(/[。；;！!]/).filter((x) => x.length > 4)
  if (sentences.length > 0) s = sentences[0].trim()
  // 截短到 30 字
  return s.length > 30 ? s.substring(0, 30) : s
}

// 从答案和解析中识别变量关系（如"反向变动"、"成正比"、"等于"）
function extractRelation(explanation: string, answer: string): string {
  if (/反向|反比|相反|负相关/.test(explanation + answer)) return '反向变动'
  if (/正向|正比|同向|同方向|正相关/.test(explanation + answer)) return '同向变动'
  if (/等于|=|恒等/.test(explanation + answer)) return '恒等关系'
  if (/大于|高于|超过/.test(explanation + answer)) return '大于关系'
  if (/小于|低于|不足/.test(explanation + answer)) return '小于关系'
  return ''
}

export interface MnemonicResult {
  type: string
  content: string
}

// 生成 4 类口诀：每条都是可直接背诵的具体内容
export function generateMnemonic(
  question: string,
  answer: string,
  explanation: string,
): string[] {
  const ans = cleanAnswer(answer)
  const kws = extractKeywords(question + ' ' + ans)
  const mainKw = kws[0] || ans.substring(0, 4) || '该知识点'
  const secondKw = kws[1] || mainKw
  const logic = extractCoreLogic(explanation)
  const relation = extractRelation(explanation, ans)

  const mnemonics: string[] = []

  // 1. 谐音口诀：直接给出谐音短句
  mnemonics.push(makeHomophone(mainKw, ans))

  // 2. 场景口诀：直接给出场景化短句
  mnemonics.push(makeScene(mainKw, ans, question))

  // 3. 顺口溜：直接给出可背诵的押韵句
  mnemonics.push(makeRhyme(mainKw, secondKw, ans, relation))

  // 4. 公式/逻辑：直接给出核心关系
  mnemonics.push(makeLogic(mainKw, ans, logic, relation))

  return mnemonics
}

// 1. 谐音口诀：用答案核心字编一句谐音短句
function makeHomophone(keyword: string, answer: string): string {
  // 取答案前 2-3 字做谐音
  const chars = answer.match(/[\u4e00-\u9fa5]/g) || []
  if (chars.length === 0) {
    return `【谐音】${answer} —— 多念三遍，读熟即记。`
  }
  const coreChars = chars.slice(0, 3).join('')
  // 谐音映射
  const homophones: Record<string, string> = {
    '价': '驾', '需': '虚', '供': '功', '弹': '弹', '率': '率',
    '量': '亮', '速': '速', '力': '力', '本': '本', '利': '利',
    '税': '睡', '债': '债', '资': '资', '产': '产', '流': '流',
    '变': '变', '平': '平', '衡': '衡', '失': '失',
    '飞': '飞', '升': '升', '降': '降', '增': '增', '减': '减',
    '正': '正', '反': '反', '高': '高', '低': '低', '大': '大',
    '小': '小', '多': '多', '少': '少', '长': '长', '短': '短',
  }
  const homophoneStr = coreChars.split('').map((c) => homophones[c] || c).join('')
  return `【谐音】${coreChars} → ${homophoneStr}（${answer}）—— "${keyword}"对应"${homophoneStr}"，多念几遍刻在脑里。`
}

// 2. 场景口诀：直接给出场景化记忆句
function makeScene(keyword: string, answer: string, question: string): string {
  let scene = ''
  if (/经济|市场|价格|货币|消费|需求|供给/.test(question)) {
    scene = `超市货架前看价牌：${answer}——${keyword}变，买不买看它脸色。`
  } else if (/飞行|航|机|空|翼|升力/.test(question)) {
    scene = `机场看飞机起降：${answer}——${keyword}决定能不能飞得稳。`
  } else if (/电|波|频|信号|电台/.test(question)) {
    scene = `电台调试旋钮：${answer}——${keyword}调对才有信号。`
  } else if (/会计|账|凭证|科目|资产|负债/.test(question)) {
    scene = `月底财务室记账：${answer}——${keyword}要分清借方贷方。`
  } else if (/法律|法规|条例|规定/.test(question)) {
    scene = `翻法规手册：${answer}——${keyword}这一条要记牢。`
  } else {
    scene = `考场上看到"${keyword}"：答案就是${answer}。`
  }
  return `【场景】${scene}`
}

// 3. 顺口溜：直接给出押韵的可背诵句
function makeRhyme(kw1: string, kw2: string, answer: string, relation: string): string {
  // 把答案缩短到核心词
  const ansShort = answer.length > 8 ? answer.substring(0, 8) : answer
  // 根据关系编顺口溜
  if (relation === '反向变动') {
    return `【口诀】${kw1}记心间，${ansShort}反向变——此长彼消，反向相关。`
  }
  if (relation === '同向变动') {
    return `【口诀】${kw1}记心间，${ansShort}同向变——齐涨齐落，同向相关。`
  }
  if (relation === '恒等关系') {
    return `【口诀】${ansShort}——左右相等，恒等不变，记住这个等式就得分。`
  }
  // 默认：关键词 + 答案
  return `【口诀】${kw1}要分清，${kw2}要记牢；${ansShort}是答案，考试不丢分。`
}

// 4. 公式/逻辑：直接给出核心关系或结论
function makeLogic(keyword: string, answer: string, logic: string, relation: string): string {
  if (relation === '反向变动') {
    return `【公式】${keyword} ↑ → ${answer} ↓；${keyword} ↓ → ${answer} ↑（反向相关）`
  }
  if (relation === '同向变动') {
    return `【公式】${keyword} ↑ → ${answer} ↑；${keyword} ↓ → ${answer} ↓（同向相关）`
  }
  if (relation === '恒等关系') {
    return `【公式】${answer}（恒等式，左右必相等）`
  }
  if (logic) {
    return `【结论】${logic}——记住这句，${answer}就是必然结果。`
  }
  return `【结论】${keyword} → ${answer}（直接对应，背下即可）`
}

// 内置经典口诀（高频题人工编写，优先于生成）
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
