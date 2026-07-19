import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AnswerLog,
  MistakeCard,
  Pet,
  Settings,
  DailyTask,
  Rank,
  RankName,
  LicenseId,
  Achievement,
} from '../types'
import {
  createMistakeCard,
  reviewMistake,
  isDueForReview,
} from '../engine/srs'
import {
  setAudioEnabled,
  setAmbientEnabled,
  setSfxVolume,
  playLevelUp,
} from '../engine/audio'

export const RANKS: Rank[] = [
  { name: '青铜', level: 1, minExp: 0, color: '#cd7f32', icon: '🥉' },
  { name: '白银', level: 2, minExp: 1000, color: '#c0c0c0', icon: '🥈' },
  { name: '黄金', level: 3, minExp: 3000, color: '#ffd700', icon: '🥇' },
  { name: '铂金', level: 4, minExp: 6000, color: '#e5e4e2', icon: '💎' },
  { name: '钻石', level: 5, minExp: 10000, color: '#b9f2ff', icon: '💠' },
  { name: '星耀', level: 6, minExp: 15000, color: '#ff2e88', icon: '🌟' },
  { name: '考证王者', level: 7, minExp: 25000, color: '#00f5ff', icon: '👑' },
]

export function getRankByExp(exp: number): Rank {
  let r = RANKS[0]
  for (const rank of RANKS) {
    if (exp >= rank.minExp) r = rank
  }
  return r
}

export function getNextRank(exp: number): Rank | null {
  for (const rank of RANKS) {
    if (exp < rank.minExp) return rank
  }
  return null
}

const DEFAULT_PETS: Pet[] = [
  {
    type: 'rocket-cat',
    name: '火箭喵',
    level: 1,
    exp: 0,
    hunger: 80,
    skills: [],
    mood: 'happy',
    lastFedAt: Date.now(),
  },
  {
    type: 'drone-dog',
    name: '无人机狗',
    level: 1,
    exp: 0,
    hunger: 80,
    skills: [],
    mood: 'happy',
    lastFedAt: Date.now(),
  },
  {
    type: 'wave-rabbit',
    name: '电波兔',
    level: 1,
    exp: 0,
    hunger: 80,
    skills: [],
    mood: 'happy',
    lastFedAt: Date.now(),
  },
  {
    type: 'abacus-dragon',
    name: '算盘龙',
    level: 1,
    exp: 0,
    hunger: 80,
    skills: [],
    mood: 'happy',
    lastFedAt: Date.now(),
  },
]

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  ttsEnabled: false,
  ambientEnabled: true,
  musicVolume: 0.5,
  sfxVolume: 0.5,
}

function makeDailyTasks(): DailyTask[] {
  return [
    { id: 'daily-1', description: '答对 10 题', target: 10, progress: 0, reward: 50, claimed: false, type: 'correct' },
    { id: 'daily-2', description: '完成 1 个关卡', target: 1, progress: 0, reward: 30, claimed: false, type: 'chapter' },
    { id: 'daily-3', description: '达成 5 连击', target: 5, progress: 0, reward: 40, claimed: false, type: 'combo' },
  ]
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

interface GameState {
  // 用户
  userId: string
  nickname: string
  coins: number
  diamonds: number
  exp: number
  combo: number
  maxCombo: number
  todayCombo: number
  // 签到
  lastSigninDate: string
  streakDays: number
  signinClaimedToday: boolean
  // 数据
  answerLogs: AnswerLog[]
  mistakes: Record<string, MistakeCard> // questionId -> card
  masteredCount: number
  // 关卡进度 licenseId-ch-N -> 'locked' | 'unlocked' | 'passed' | 'perfect'
  nodeProgress: Record<string, 'locked' | 'unlocked' | 'passed' | 'perfect'>
  // 宠物
  pets: Pet[]
  activePet: number
  // 成就
  achievements: Achievement[]
  // 设置
  settings: Settings
  // 每日任务
  dailyTasks: DailyTask[]
  dailyTasksDate: string
  // 全局统计
  totalAnswered: number
  totalCorrect: number
  studyDays: string[] // ISO date strings
  // Actions
  answer: (questionId: string, isCorrect: boolean, quality: number, timeSpentMs: number) => {
    coinsGain: number
    expGain: number
    isCrit: boolean
    comboBonus: number
    masteredNow: boolean
    rankUp: boolean
  }
  breakCombo: () => void
  claimSignin: () => { coins: number; days: number; alreadyClaimed: boolean }
  feedPet: (petIndex: number) => void
  setActivePet: (index: number) => void
  updateSettings: (s: Partial<Settings>) => void
  unlockNode: (nodeId: string) => void
  passNode: (nodeId: string, perfect: boolean) => void
  claimDailyTask: (taskId: string) => { coins: number }
  buyItem: (cost: number, useDiamonds?: boolean) => boolean
  resetAll: () => void
  exportData: () => string
  importData: (json: string) => boolean
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      userId: 'astro-' + Math.random().toString(36).slice(2, 10),
      nickname: '宇航员',
      coins: 100,
      diamonds: 5,
      exp: 0,
      combo: 0,
      maxCombo: 0,
      todayCombo: 0,
      lastSigninDate: '',
      streakDays: 0,
      signinClaimedToday: false,
      answerLogs: [],
      mistakes: {},
      masteredCount: 0,
      nodeProgress: {},
      pets: DEFAULT_PETS,
      activePet: 0,
      achievements: [],
      settings: DEFAULT_SETTINGS,
      dailyTasks: makeDailyTasks(),
      dailyTasksDate: todayStr(),
      totalAnswered: 0,
      totalCorrect: 0,
      studyDays: [],

      answer: (questionId, isCorrect, quality, timeSpentMs) => {
        const state = get()
        const now = Date.now()
        const today = todayStr()

        // 添加答题日志
        const log: AnswerLog = {
          questionId,
          isCorrect,
          quality,
          answeredAt: now,
          timeSpentMs,
        }
        const answerLogs = [...state.answerLogs, log].slice(-500)

        // 更新统计
        const totalAnswered = state.totalAnswered + 1
        const totalCorrect = state.totalCorrect + (isCorrect ? 1 : 0)
        const studyDays = state.studyDays.includes(today)
          ? state.studyDays
          : [...state.studyDays, today].slice(-365)

        // 错题处理
        let mistakes = { ...state.mistakes }
        let masteredNow = false
        if (!isCorrect) {
          if (mistakes[questionId]) {
            mistakes[questionId] = reviewMistake(mistakes[questionId], quality)
          } else {
            mistakes[questionId] = createMistakeCard(questionId)
          }
        } else {
          if (mistakes[questionId]) {
            const before = mistakes[questionId].mastered
            mistakes[questionId] = reviewMistake(mistakes[questionId], quality)
            if (!before && mistakes[questionId].mastered) {
              masteredNow = true
            }
          }
        }

        // 计算奖励
        let coinsGain = 0
        let expGain = 0
        let comboBonus = 0
        let isCrit = false
        let combo = state.combo
        let todayCombo = state.todayCombo
        let maxCombo = state.maxCombo

        if (isCorrect) {
          combo += 1
          todayCombo = Math.max(todayCombo, combo)
          maxCombo = Math.max(maxCombo, combo)
          // 基础金币
          coinsGain = 1
          expGain = 5
          // 暴击
          if (Math.random() < 0.05) {
            isCrit = true
            coinsGain *= 2
            expGain *= 2
          }
          // 连击奖励
          if (combo >= 5) {
            comboBonus = Math.floor(combo / 5)
            coinsGain += comboBonus
            expGain += comboBonus * 2
          }
          // 难度奖励
          const q = state.answerLogs.length > 0 ? 1 : 1
          // 宠物加成
          const pet = state.pets[state.activePet]
          if (pet && pet.level >= 3) {
            coinsGain = Math.ceil(coinsGain * 1.1)
          }
        } else {
          combo = 0
        }

        const coins = state.coins + coinsGain + (masteredNow ? 50 : 0)
        const beforeExp = state.exp
        const exp = state.exp + expGain + (masteredNow ? 100 : 0)

        // 段位升级检测
        const beforeRank = getRankByExp(beforeExp)
        const afterRank = getRankByExp(exp)
        const rankUp = afterRank.level > beforeRank.level
        let diamonds = state.diamonds
        if (rankUp) {
          diamonds += 5
          setTimeout(() => playLevelUp(), 200)
        }

        // 更新每日任务
        let dailyTasks = state.dailyTasks.map((t) => {
          let progress = t.progress
          if (!t.claimed) {
            if (t.type === 'correct' && isCorrect) progress = Math.min(t.target, t.progress + 1)
            else if (t.type === 'answer') progress = Math.min(t.target, t.progress + 1)
            else if (t.type === 'combo' && isCorrect) progress = Math.max(t.progress, combo)
          }
          return { ...t, progress }
        })

        // 日期变更重置每日任务
        let dailyTasksDate = state.dailyTasksDate
        if (state.dailyTasksDate !== today) {
          dailyTasks = makeDailyTasks()
          dailyTasksDate = today
          if (isCorrect) {
            dailyTasks = dailyTasks.map((t) =>
              t.type === 'correct' ? { ...t, progress: 1 } : t,
            )
          }
        }

        set({
          answerLogs,
          mistakes,
          coins,
          exp,
          diamonds,
          combo,
          todayCombo,
          maxCombo,
          totalAnswered,
          totalCorrect,
          studyDays,
          masteredCount: Object.values(mistakes).filter((m) => m.mastered).length,
          dailyTasks,
          dailyTasksDate,
        })

        return {
          coinsGain: coinsGain + (masteredNow ? 50 : 0),
          expGain: expGain + (masteredNow ? 100 : 0),
          isCrit,
          comboBonus,
          masteredNow,
          rankUp,
        }
      },

      breakCombo: () => set({ combo: 0 }),

      claimSignin: () => {
        const state = get()
        const today = todayStr()
        if (state.signinClaimedToday && state.lastSigninDate === today) {
          return { coins: 0, days: state.streakDays, alreadyClaimed: true }
        }
        // 计算连签
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yStr = yesterday.toISOString().slice(0, 10)
        const streak = state.lastSigninDate === yStr ? state.streakDays + 1 : 1
        const reward = Math.min(100, 10 + (streak - 1) * 15)
        set({
          coins: state.coins + reward,
          streakDays: streak,
          lastSigninDate: today,
          signinClaimedToday: true,
          exp: state.exp + 20,
        })
        return { coins: reward, days: streak, alreadyClaimed: false }
      },

      feedPet: (petIndex) => {
        const state = get()
        if (state.coins < 5) return
        const pets = [...state.pets]
        const pet = { ...pets[petIndex] }
        pet.hunger = Math.min(100, pet.hunger + 20)
        pet.exp += 10
        pet.lastFedAt = Date.now()
        if (pet.exp >= pet.level * 100) {
          pet.level += 1
          pet.exp = 0
          if (pet.level === 3 && !pet.skills.includes('双倍经验')) {
            pet.skills.push('双倍经验')
          }
          if (pet.level === 5 && !pet.skills.includes('免错一次')) {
            pet.skills.push('免错一次')
          }
        }
        pets[petIndex] = pet
        set({ coins: state.coins - 5, pets })
      },

      setActivePet: (index) => set({ activePet: index }),

      updateSettings: (s) => {
        const settings = { ...get().settings, ...s }
        set({ settings })
        setAudioEnabled(settings.soundEnabled)
        setAmbientEnabled(settings.ambientEnabled)
        setSfxVolume(settings.sfxVolume)
      },

      unlockNode: (nodeId) => {
        const nodeProgress = { ...get().nodeProgress }
        if (!nodeProgress[nodeId] || nodeProgress[nodeId] === 'locked') {
          nodeProgress[nodeId] = 'unlocked'
          set({ nodeProgress })
        }
      },

      passNode: (nodeId, perfect) => {
        const state = get()
        const nodeProgress = { ...state.nodeProgress }
        nodeProgress[nodeId] = perfect ? 'perfect' : 'passed'
        // 奖励
        const bonus = perfect ? 80 : 50
        set({
          nodeProgress,
          coins: state.coins + bonus,
          exp: state.exp + bonus,
        })
      },

      claimDailyTask: (taskId) => {
        const state = get()
        const task = state.dailyTasks.find((t) => t.id === taskId)
        if (!task || task.claimed || task.progress < task.target) return { coins: 0 }
        const dailyTasks = state.dailyTasks.map((t) =>
          t.id === taskId ? { ...t, claimed: true } : t,
        )
        set({
          dailyTasks,
          coins: state.coins + task.reward,
          exp: state.exp + task.reward,
        })
        return { coins: task.reward }
      },

      buyItem: (cost, useDiamonds = false) => {
        const state = get()
        if (useDiamonds) {
          if (state.diamonds < cost) return false
          set({ diamonds: state.diamonds - cost })
          return true
        }
        if (state.coins < cost) return false
        set({ coins: state.coins - cost })
        return true
      },

      resetAll: () => {
        set({
          userId: 'astro-' + Math.random().toString(36).slice(2, 10),
          coins: 100,
          diamonds: 5,
          exp: 0,
          combo: 0,
          maxCombo: 0,
          todayCombo: 0,
          lastSigninDate: '',
          streakDays: 0,
          signinClaimedToday: false,
          answerLogs: [],
          mistakes: {},
          masteredCount: 0,
          nodeProgress: {},
          pets: DEFAULT_PETS,
          activePet: 0,
          achievements: [],
          dailyTasks: makeDailyTasks(),
          dailyTasksDate: todayStr(),
          totalAnswered: 0,
          totalCorrect: 0,
          studyDays: [],
        })
      },

      exportData: () => {
        return JSON.stringify(get(), null, 2)
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json)
          set(data)
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: 'cert-planet-save',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// 获取到期错题
export function getDueMistakes(): MistakeCard[] {
  const mistakes = useGameStore.getState().mistakes
  return Object.values(mistakes).filter(isDueForReview)
}

// 获取顽固错题（Lv3）
export function getStubbornMistakes(): MistakeCard[] {
  const mistakes = useGameStore.getState().mistakes
  return Object.values(mistakes).filter((m) => m.level === 3 && !m.mastered)
}
