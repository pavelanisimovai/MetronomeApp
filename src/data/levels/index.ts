import { difficultyEase } from './difficulties.ts'
import { echoLevels } from './echo.ts'
import { keepLevels } from './keep.ts'
import { memoryLevels } from './memory.ts'
import { silentLevels } from './silent.ts'
import type { Difficulty, GameId, LevelDef, SkillPillar } from './types.ts'

export type {
  Difficulty,
  GameId,
  LevelDef,
  PatternStep,
  SkillPillar,
  DifficultyBand,
} from './types.ts'
export { difficultyBands, difficultyEase, bandFor } from './difficulties.ts'

export const skillPillars: SkillPillar[] = [
  {
    id: 'keep',
    label: 'Steady beat',
    blurb: 'Tap along with a regular click.',
  },
  {
    id: 'echo',
    label: 'Copy a rhythm',
    blurb: 'Listen, then copy the sounds and quiet spaces.',
  },
  {
    id: 'memory',
    label: 'Remember a rhythm',
    blurb: 'Play it again without the visual guide.',
  },
  {
    id: 'silent',
    label: 'Keep going in silence',
    blurb: 'Keep tapping when the clicks go quiet.',
  },
]

export const allLevels: LevelDef[] = [
  ...keepLevels,
  ...echoLevels,
  ...memoryLevels,
  ...silentLevels,
]

/** Foundations across all skills before advanced variants. Library access remains open. */
export const curriculum = allLevels
  .slice()
  .sort((a, b) => a.difficulty - b.difficulty)
export type Achievement = { stars?: number; verifiedStars?: number }
export function earnedStars(result?: Achievement): number {
  return result?.verifiedStars ?? 0
}
export function prerequisiteFor(id: string): LevelDef | undefined {
  return curriculum[curriculum.findIndex((l) => l.id === id) - 1]
}

export function levelsFor(game: GameId): LevelDef[] {
  return allLevels.filter((l) => l.game === game)
}

export function levelsForDifficulty(d: Difficulty): LevelDef[] {
  return allLevels.filter((l) => l.difficulty === d)
}

export function getLevel(id: string): LevelDef | undefined {
  return allLevels.find((l) => l.id === id)
}

export function timingEaseFor(level: LevelDef): number {
  return level.timingEase ?? difficultyEase(level.difficulty)
}

export function nextLevelFor(
  game: GameId,
  completed: Record<string, Achievement>,
): LevelDef | undefined {
  const list = levelsFor(game)
  return (
    list.find((l) => earnedStars(completed[l.id]) < 1) ?? list[list.length - 1]
  )
}

export function recommendedLevel(
  completed: Record<string, Achievement>,
): LevelDef {
  // Prefer easiest unfinished level across the whole curriculum
  const unfinished = curriculum.find((l) => earnedStars(completed[l.id]) < 1)
  if (unfinished) return unfinished
  return keepLevels[0]
}

export function recommendedDifficulty(
  completed: Record<string, Achievement>,
): Difficulty {
  return recommendedLevel(completed).difficulty
}

/** Three consecutive lessons from the current learning path. */
export function dailyDrillLevels(
  date?: Date,
  completed: Record<string, Achievement> = {},
): LevelDef[] {
  // A real three-lesson session follows the same progression as the main path.
  void date
  const first = curriculum.findIndex(
    (l) => l.id === recommendedLevel(completed).id,
  )
  return Array.from(
    { length: 3 },
    (_, i) => curriculum[(first + i) % curriculum.length],
  )
}

export function starsInDifficulty(
  d: Difficulty,
  completed: Record<string, Achievement>,
): { earned: number; max: number; cleared: number; total: number } {
  const list = levelsForDifficulty(d)
  const cleared = list.filter((l) => earnedStars(completed[l.id]) > 0).length
  const earned = list.reduce((sum, l) => sum + earnedStars(completed[l.id]), 0)
  return { earned, max: list.length * 3, cleared, total: list.length }
}
