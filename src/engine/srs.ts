import type { MistakeCard } from '../types'

// SM-2 间隔重复算法改良版
// quality: 0=完全忘记 1=错了但见过 2=错了但接近 3=犹豫但对了 4=对了但费力 5=轻松答对

export function createMistakeCard(questionId: string): MistakeCard {
  const now = Date.now()
  return {
    questionId,
    ef: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: now + 1 * 24 * 60 * 60 * 1000, // 1 天后
    consecutiveCorrect: 0,
    mastered: false,
    level: 1,
    addedAt: now,
    lastReviewedAt: now,
    wrongCount: 1,
  }
}

export function reviewMistake(card: MistakeCard, quality: number): MistakeCard {
  const now = Date.now()
  let { ef, interval, repetitions, consecutiveCorrect, level, wrongCount } = card

  // 错题等级：错1次Lv1，错2次Lv2，错3次以上Lv3
  if (quality < 3) {
    wrongCount += 1
    level = wrongCount >= 3 ? 3 : wrongCount >= 2 ? 2 : 1
    consecutiveCorrect = 0
    repetitions = 0
    interval = 1
    ef = Math.max(1.3, ef - 0.2)
  } else {
    consecutiveCorrect += 1
    repetitions += 1
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if (ef < 1.3) ef = 1.3
    if (ef > 2.8) ef = 2.8

    if (repetitions === 1) interval = 1
    else if (repetitions === 2) interval = 3
    else if (repetitions === 3) interval = 7
    else if (repetitions === 4) interval = 15
    else interval = Math.round(interval * ef)
  }

  // 连续答对 4 次以上视为已掌握
  const mastered = consecutiveCorrect >= 4

  return {
    ...card,
    ef,
    interval,
    repetitions,
    consecutiveCorrect,
    level,
    wrongCount,
    mastered,
    nextReview: now + interval * 24 * 60 * 60 * 1000,
    lastReviewedAt: now,
  }
}

export function isDueForReview(card: MistakeCard): boolean {
  if (card.mastered) return false
  return Date.now() >= card.nextReview
}

export function getDaysUntilReview(card: MistakeCard): number {
  const ms = card.nextReview - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function getMasteryProgress(card: MistakeCard): number {
  // 0-100
  if (card.mastered) return 100
  return Math.min(99, (card.consecutiveCorrect / 4) * 100)
}
