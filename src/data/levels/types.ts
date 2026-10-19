export type GameId = 'keep' | 'echo' | 'memory' | 'silent'

export type PatternStep = 0 | 1

export type LevelDef = {
  id: string
  game: GameId
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
  /** Pattern grid for echo/memory — 1 = hit, 0 = rest, length = bars * beats * subdivision */
  pattern?: PatternStep[]
  unlockAfter?: string | null
}

export type SkillPillar = {
  id: GameId
  label: string
  blurb: string
}
