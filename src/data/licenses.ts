import pplQuestions from './questions/ppl.json'
import uavQuestions from './questions/uav.json'
import hamQuestions from './questions/ham.json'
import ecoQuestions from './questions/eco.json'
import type { License, LicenseId, Chapter, Question } from '../types'

export const QUESTIONS: Record<LicenseId, Question[]> = {
  ppl: pplQuestions as Question[],
  uav: uavQuestions as Question[],
  ham: hamQuestions as Question[],
  eco: ecoQuestions as Question[],
}

// 生成章节（按 category 分组）
function buildChapters(licenseId: LicenseId): Chapter[] {
  const questions = QUESTIONS[licenseId]
  const seen = new Map<string, Question[]>()
  for (const q of questions) {
    if (!seen.has(q.category)) seen.set(q.category, [])
    seen.get(q.category)!.push(q)
  }
  return Array.from(seen.entries()).map(([category, qs], i) => ({
    id: `${licenseId}-ch-${i + 1}`,
    licenseId,
    name: category,
    category,
    description: `${qs.length} 题 · ${category}`,
    icon: '📘',
    order: i + 1,
  }))
}

export const CHAPTERS: Record<LicenseId, Chapter[]> = {
  ppl: buildChapters('ppl'),
  uav: buildChapters('uav'),
  ham: buildChapters('ham'),
  eco: buildChapters('eco'),
}

export const LICENSES: License[] = [
  {
    id: 'uav',
    code: 'UAV',
    name: '无人机',
    fullName: 'CAAC 无人机执照',
    icon: '🚁',
    color: '#00f5ff',
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
    planetColor: '#00d4ff',
    description: '视距内 / 超视距驾驶员',
    fullDescription: '中国民航局 CAAC 无人机驾驶员执照，涵盖系统组成、法规空域、气象、飞行原理、性能、通信导航、任务规划、运行与应急处置。',
    chapterIds: CHAPTERS.uav.map((c) => c.id),
    questionsCount: uavQuestions.length,
  },
  {
    id: 'ppl',
    code: 'PPL',
    name: '飞行执照',
    fullName: '私用飞行员执照',
    icon: '✈️',
    color: '#ff2e88',
    gradient: 'from-pink-500 via-fuchsia-500 to-purple-600',
    planetColor: '#ff5fa0',
    description: '私照 / 运动类理论',
    fullDescription: '中国民航 CCAR-61 部私用驾驶员执照理论，涵盖法规、飞行原理、性能、重量平衡、气象、领航、仪表系统、ATC 通话与人为因素。',
    chapterIds: CHAPTERS.ppl.map((c) => c.id),
    questionsCount: pplQuestions.length,
  },
  {
    id: 'ham',
    code: 'HAM',
    name: '无线电',
    fullName: '业余无线电操作证',
    icon: '📡',
    color: '#ffd700',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    planetColor: '#ffcc33',
    description: 'A / B / C 类操作证',
    fullDescription: 'CRAC 中国无线电协会业余无线电操作证书，涵盖法规、基础知识、操作礼仪、电波传播、天线、电路、电磁兼容与安全常识。',
    chapterIds: CHAPTERS.ham.map((c) => c.id),
    questionsCount: hamQuestions.length,
  },
  {
    id: 'eco',
    code: 'ECO',
    name: '中级经济师',
    fullName: '中级经济师《经济基础》',
    icon: '💼',
    color: '#9d4edd',
    gradient: 'from-violet-500 via-purple-500 to-indigo-600',
    planetColor: '#b46eff',
    description: '经济基础知识',
    fullDescription: '中级经济师《经济基础知识》，涵盖经济学基础、财政、货币与金融、统计、会计、法律六大模块。',
    chapterIds: CHAPTERS.eco.map((c) => c.id),
    questionsCount: ecoQuestions.length,
  },
]

export function getLicense(id: LicenseId): License {
  return LICENSES.find((l) => l.id === id)!
}

export function getChapters(licenseId: LicenseId): Chapter[] {
  return CHAPTERS[licenseId]
}

export function getQuestionsByChapter(chapterId: string): Question[] {
  const [licenseId, numStr] = chapterId.split('-ch-')
  const chapter = CHAPTERS[licenseId as LicenseId][parseInt(numStr) - 1]
  if (!chapter) return []
  return QUESTIONS[licenseId as LicenseId].filter((q) => q.category === chapter.category)
}

export function getQuestionsByLicense(licenseId: LicenseId): Question[] {
  return QUESTIONS[licenseId]
}

export function getQuestion(id: string): Question | undefined {
  for (const licenseId of ['uav', 'ppl', 'ham', 'eco'] as LicenseId[]) {
    const q = QUESTIONS[licenseId].find((q) => q.id === id)
    if (q) return q
  }
  return undefined
}
