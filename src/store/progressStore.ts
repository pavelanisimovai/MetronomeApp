import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameId } from '../data/levels/types'

export type LevelResult = {
  bestScore: number
  bestAccuracy: number
  stars: 0 | 1 | 2 | 3
  plays: number
  lastPlayedAt: string
}

type ProgressState = {
  levels: Record<string, LevelResult>
  streakDays: number
  lastPracticeDate: string | null
  recentAccuracies: number[]
  recordResult: (levelId: string, score: number, accuracy: number, stars: 0 | 1 | 2 | 3) => void
  markPracticeToday: () => void
  skillFor: (gameId: GameId) => number
  totalStars: () => number
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      levels: {},
      streakDays: 0,
      lastPracticeDate: null,
      recentAccuracies: [],
      recordResult: (levelId, score, accuracy, stars) => {
        set((state) => {
          const prev = state.levels[levelId]
          const next: LevelResult = {
            bestScore: Math.max(prev?.bestScore ?? 0, score),
            bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
            stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
            plays: (prev?.plays ?? 0) + 1,
            lastPlayedAt: new Date().toISOString(),
          }
          const recent = [...state.recentAccuracies, accuracy].slice(-20)
          return { levels: { ...state.levels, [levelId]: next }, recentAccuracies: recent }
        })
        get().markPracticeToday()
      },
      markPracticeToday: () => {
        const today = todayKey()
        const { lastPracticeDate, streakDays } = get()
        if (lastPracticeDate === today) return
        const nextStreak =
          lastPracticeDate === yesterdayKey() ? streakDays + 1 : lastPracticeDate ? 1 : 1
        set({ lastPracticeDate: today, streakDays: nextStreak })
      },
      skillFor: (gameId) => {
        const entries = Object.entries(get().levels).filter(([id]) => id.startsWith(`${gameId}-`))
        if (!entries.length) return 0
        const avg =
          entries.reduce((sum, [, r]) => sum + r.bestAccuracy, 0) / Math.max(1, entries.length)
        return Math.round(avg)
      },
      totalStars: () =>
        Object.values(get().levels).reduce((sum, r) => sum + r.stars, 0),
    }),
    { name: 'mymetronome-progress' },
  ),
)
