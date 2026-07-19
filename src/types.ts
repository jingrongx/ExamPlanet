// 类型定义
export interface Question {
  id: string
  category: string
  question: string
  options: string[]
  answer: string
  explanation: string
  difficulty: number
  mnemonic?: string
}

export interface Chapter {
  id: string
  licenseId: LicenseId
  name: string
  category: string // 对应题目 category
  description: string
  icon: string
  order: number
}

export interface License {
  id: LicenseId
  code: string
  name: string
  fullName: string
  icon: string
  color: string
  gradient: string
  planetColor: string
  description: string
  fullDescription: string
  chapterIds: string[]
  questionsCount: number
}

export type LicenseId = 'ppl' | 'uav' | 'ham' | 'eco'

export type NodeType = 'normal' | 'elite' | 'boss' | 'hidden'

export interface LevelNode {
  id: string
  chapterId: string
  type: NodeType
  name: string
  questionIds: string[]
  unlocked: boolean
}

// 答题记录
export interface AnswerLog {
  questionId: string
  isCorrect: boolean
  quality: number
  answeredAt: number
  timeSpentMs: number
}

// 错题（间隔重复卡片）
export interface MistakeCard {
  questionId: string
  ef: number
  interval: number
  repetitions: number
  nextReview: number
  consecutiveCorrect: number
  mastered: boolean
  level: 1 | 2 | 3
  addedAt: number
  lastReviewedAt: number
  wrongCount: number
}

// 段位
export type RankName =
  | '青铜'
  | '白银'
  | '黄金'
  | '铂金'
  | '钻石'
  | '星耀'
  | '考证王者'

export interface Rank {
  name: RankName
  level: number // 1-7
  minExp: number
  color: string
  icon: string
}

// 宠物
export interface Pet {
  type: 'rocket-cat' | 'drone-dog' | 'wave-rabbit' | 'abacus-dragon'
  name: string
  level: number
  exp: number
  hunger: number // 0-100
  skills: string[]
  mood: 'happy' | 'normal' | 'sad'
  lastFedAt: number
}

// 成就
export interface Achievement {
  code: string
  name: string
  description: string
  icon: string
  unlockedAt?: number
  progress?: number
  target?: number
}

// 用户设置
export interface Settings {
  soundEnabled: boolean
  ttsEnabled: boolean
  ambientEnabled: boolean
  musicVolume: number
  sfxVolume: number
}

// 每日任务
export interface DailyTask {
  id: string
  description: string
  target: number
  progress: number
  reward: number
  claimed: boolean
  type: 'answer' | 'correct' | 'combo' | 'chapter'
}
