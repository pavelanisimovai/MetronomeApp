export type HitGrade = 'perfect' | 'good' | 'ok' | 'miss'

/** Touch-friendly windows — phone taps are slower than MIDI pads. */
export const HIT_WINDOWS_MS = {
  perfect: 55,
  good: 120,
  ok: 250,
} as const

export function gradeHit(errorMs: number, offsetMs = 0): HitGrade {
  const abs = Math.abs(errorMs - offsetMs)
  if (abs <= HIT_WINDOWS_MS.perfect) return 'perfect'
  if (abs <= HIT_WINDOWS_MS.good) return 'good'
  if (abs <= HIT_WINDOWS_MS.ok) return 'ok'
  return 'miss'
}

export function gradeScore(grade: HitGrade): number {
  switch (grade) {
    case 'perfect':
      return 100
    case 'good':
      return 70
    case 'ok':
      return 40
    default:
      return 0
  }
}

export function starsFromAccuracy(accuracy: number): 0 | 1 | 2 | 3 {
  if (accuracy >= 92) return 3
  if (accuracy >= 78) return 2
  if (accuracy >= 60) return 1
  return 0
}

/** Rolling tap-tempo estimator from absolute timestamps (ms). */
export function estimateTapTempo(timestampsMs: number[]): number | null {
  if (timestampsMs.length < 2) return null
  const intervals: number[] = []
  for (let i = 1; i < timestampsMs.length; i++) {
    const dt = timestampsMs[i] - timestampsMs[i - 1]
    if (dt > 0 && dt < 2500) intervals.push(dt)
  }
  if (!intervals.length) return null
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const bpm = Math.round(60000 / avg)
  return Math.min(250, Math.max(30, bpm))
}

export function beatDurationSec(bpm: number): number {
  return 60 / bpm
}

export function nearestExpected(
  tapTimeSec: number,
  expectedTimesSec: number[],
): { index: number; expected: number; errorMs: number } | null {
  if (!expectedTimesSec.length) return null
  let best = 0
  let bestAbs = Infinity
  for (let i = 0; i < expectedTimesSec.length; i++) {
    const err = Math.abs(tapTimeSec - expectedTimesSec[i])
    if (err < bestAbs) {
      bestAbs = err
      best = i
    }
  }
  const expected = expectedTimesSec[best]
  return {
    index: best,
    expected,
    errorMs: (tapTimeSec - expected) * 1000,
  }
}
