import type { Difficulty, DifficultyBand } from './types'

export const difficultyBands: DifficultyBand[] = [
  {
    id: 1,
    label: 'First beats',
    ages: 'Start here',
    blurb: 'Short patterns with a guide whenever you need it.',
  },
  {
    id: 2,
    label: 'Steady timing',
    ages: 'Build confidence',
    blurb: 'Still gentle. A bit longer, with simple rests.',
  },
  {
    id: 3,
    label: 'Rhythm patterns',
    ages: 'Beginner',
    blurb: 'Solid everyday practice — the classic training pace.',
  },
  {
    id: 4,
    label: 'Independence',
    ages: 'Intermediate',
    blurb: 'Faster tempos, syncopation, and trickier patterns.',
  },
  {
    id: 5,
    label: 'Advanced',
    ages: 'Advanced',
    blurb: 'Dense grids, odd meters, and deep silence gaps.',
  },
]

export function difficultyEase(d: Difficulty): number {
  switch (d) {
    case 1:
      return 1.8
    case 2:
      return 1.45
    case 3:
      return 1.15
    case 4:
      return 1
    case 5:
      return 0.9
  }
}

export function bandFor(d: Difficulty): DifficultyBand {
  return difficultyBands.find((b) => b.id === d) ?? difficultyBands[0]
}
