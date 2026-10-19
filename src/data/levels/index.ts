import { difficultyEase } from './difficulties'
import { echoLevels } from './echo'
import { keepLevels } from './keep'
import { memoryLevels } from './memory'
import { silentLevels } from './silent'
import type { Difficulty, GameId, LevelDef, SkillPillar } from './types'

export type { Difficulty, GameId, LevelDef, PatternStep, SkillPillar, DifficultyBand } from './types'
export { difficultyBands, difficultyEase, bandFor } from './difficulties'

export const skillPillars: SkillPillar[] = [
  { id: 'keep', label: 'Pulse', blurb: 'Lock a steady beat under pressure.' },
  { id: 'echo', label: 'Echo', blurb: 'Hear a rhythm, play it back in time.' },
  { id: 'memory', label: 'Memory', blurb: 'Internalize patterns without the grid.' },
  { id: 'silent', label: 'Continuity', blurb: 'Keep time when the click disappears.' },
]

export const allLevels: LevelDef[] = [
  ...keepLevels,
  ...echoLevels,
  ...memoryLevels,
  ...silentLevels,
]

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
  completed: Record<string, { stars: number }>,
): LevelDef | undefined {
  const list = levelsFor(game)
  return list.find((l) => (completed[l.id]?.stars ?? 0) < 1) ?? list[list.length - 1]
}

export function recommendedLevel(
  completed: Record<string, { stars: number }>,
): LevelDef {
  // Prefer easiest unfinished level across the whole curriculum
  const unfinished = allLevels.find((l) => (completed[l.id]?.stars ?? 0) < 1)
  if (unfinished) return unfinished
  return keepLevels[0]
}

export function recommendedDifficulty(
  completed: Record<string, { stars: number }>,
): Difficulty {
  return recommendedLevel(completed).difficulty
}

/** Deterministic daily drill from the player's current difficulty band. */
export function dailyDrillLevels(
  date = new Date(),
  completed: Record<string, { stars: number }> = {},
): LevelDef[] {
  const seed = Number(date.toISOString().slice(0, 10).replace(/-/g, ''))
  const d = recommendedDifficulty(completed)
  const pool = levelsForDifficulty(d)
  const picks: LevelDef[] = []
  for (let i = 0; i < 3; i++) {
    picks.push(pool[(seed + i * 3) % pool.length])
  }
  return picks
}

export function starsInDifficulty(
  d: Difficulty,
  completed: Record<string, { stars: number }>,
): { earned: number; max: number; cleared: number; total: number } {
  const list = levelsForDifficulty(d)
  const cleared = list.filter((l) => (completed[l.id]?.stars ?? 0) > 0).length
  const earned = list.reduce((sum, l) => sum + (completed[l.id]?.stars ?? 0), 0)
  return { earned, max: list.length * 3, cleared, total: list.length }
}
