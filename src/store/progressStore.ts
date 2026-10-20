import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameId } from '../data/levels/types'
import { levelsFor, earnedStars } from '../data/levels'
import type { SessionScore } from '../games/shared/scoring'
import { currentStreak, localDateKey, yesterdayKey } from '../utils/dates'

export type LevelResult = {
  bestScore: number
  bestAccuracy: number
  stars: 0 | 1 | 2 | 3
  plays: number
  lastPlayedAt: string
  verifiedStars?: number
  verifiedBestAccuracy?: number
  verifiedBestScore?: number
  successfulAttempts?: number
  latestAccuracy?: number
}

type ProgressState = {
  levels: Record<string, LevelResult>
  streakDays: number
  lastPracticeDate: string | null
  recentAccuracies: number[]
  recentVerifiedAccuracies: number[]
  recordResult: (levelId: string, result: SessionScore) => void
  markPracticeToday: () => void
  skillFor: (gameId: GameId) => number
  totalStars: () => number
  activeStreak: () => number
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      levels: {},
      streakDays: 0,
      lastPracticeDate: null,
      recentAccuracies: [],
      recentVerifiedAccuracies: [],
      recordResult: (levelId, result) => {
        // An unattended timer is not a learning attempt or a practice day.
        if (!result.taps) return
        set((state) => {
          const prev = state.levels[levelId]
          return {
            levels: {
              ...state.levels,
              [levelId]: {
                // Keep historical bests; verified results use the new scoring rules separately.
                bestScore: Math.max(prev?.bestScore ?? 0, result.score),
                bestAccuracy: Math.max(
                  prev?.bestAccuracy ?? 0,
                  result.accuracy,
                ),
                stars: Math.max(
                  prev?.stars ?? 0,
                  result.stars,
                ) as LevelResult['stars'],
                plays: (prev?.plays ?? 0) + 1,
                lastPlayedAt: new Date().toISOString(),
                verifiedStars: Math.max(prev?.verifiedStars ?? 0, result.stars),
                verifiedBestAccuracy: Math.max(
                  prev?.verifiedBestAccuracy ?? 0,
                  result.accuracy,
                ),
                verifiedBestScore: Math.max(
                  prev?.verifiedBestScore ?? 0,
                  result.score,
                ),
                successfulAttempts:
                  (prev?.successfulAttempts ?? 0) +
                  (result.accuracy >= 78 && !result.extra && !result.miss
                    ? 1
                    : 0),
                latestAccuracy: result.accuracy,
              },
            },
            recentVerifiedAccuracies: [
              ...state.recentVerifiedAccuracies,
              result.accuracy,
            ].slice(-20),
          }
        })
        get().markPracticeToday()
      },
      markPracticeToday: () => {
        const today = localDateKey()
        const { lastPracticeDate, streakDays } = get()
        if (lastPracticeDate !== today)
          set({
            lastPracticeDate: today,
            streakDays:
              lastPracticeDate === yesterdayKey() ? streakDays + 1 : 1,
          })
      },
      activeStreak: () =>
        currentStreak(get().lastPracticeDate, get().streakDays),
      // Coverage, not a claim of musical ability: one cleared lesson out of ten is 10%.
      skillFor: (game) =>
        Math.round(
          (levelsFor(game).filter((l) => earnedStars(get().levels[l.id]) > 0)
            .length /
            levelsFor(game).length) *
            100,
        ),
      totalStars: () =>
        Object.values(get().levels).reduce((sum, r) => sum + earnedStars(r), 0),
    }),
    { name: 'mymetronome-progress' },
  ),
)
