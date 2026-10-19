import { echoLevels } from './echo'
import { keepLevels } from './keep'
import { memoryLevels } from './memory'
import { silentLevels } from './silent'
import type { GameId, LevelDef, SkillPillar } from './types'

export type { GameId, LevelDef, PatternStep, SkillPillar } from './types'

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

export function getLevel(id: string): LevelDef | undefined {
  return allLevels.find((l) => l.id === id)
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
  for (const pillar of skillPillars) {
    const next = nextLevelFor(pillar.id, completed)
    if (next && (completed[next.id]?.stars ?? 0) < 1) return next
  }
  return keepLevels[0]
}

/** Deterministic daily drill: 3 levels mixed across pillars based on date. */
export function dailyDrillLevels(date = new Date()): LevelDef[] {
  const seed = Number(date.toISOString().slice(0, 10).replace(/-/g, ''))
  const picks: LevelDef[] = []
  const pools = [keepLevels, echoLevels, memoryLevels, silentLevels]
  for (let i = 0; i < 3; i++) {
    const pool = pools[(seed + i) % pools.length]
    picks.push(pool[(seed + i * 3) % pool.length])
  }
  return picks
}
