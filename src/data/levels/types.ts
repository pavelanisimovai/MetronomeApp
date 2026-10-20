export type GameId = 'keep' | 'echo' | 'memory' | 'silent'

/** 1 = tiny kids · 3 ≈ previous default · 5 = advanced */
export type Difficulty = 1 | 2 | 3 | 4 | 5

export type PatternStep = 0 | 1

export type LevelDef = {
  id: string
  game: GameId
  difficulty: Difficulty
  title: string
  description: string
  bpm: number
  bars: number
  beatsPerBar: number
  subdivision: 1 | 2 | 3 | 4
  /** For keep/silent: how many beats to tap */
  durationBeats?: number
  /** For silent: play N bars then mute M */
  playBars?: number
  muteBars?: number
  /** Pattern grid for echo/memory — 1 = hit, 0 = rest */
  pattern?: PatternStep[]
  unlockAfter?: string | null
  responseClick?: 'none' | 'beat' | 'downbeat'
  /** Explicit short gaps for introductory silence exercises. */
  quietSteps?: number[]
  /**
   * Multiplier for hit windows. Higher = more forgiving (great for young kids).
   * Defaults from difficulty if omitted.
   */
  timingEase?: number
}

export type SkillPillar = {
  id: GameId
  label: string
  blurb: string
}

export type DifficultyBand = {
  id: Difficulty
  label: string
  ages: string
  blurb: string
}
