import { gradeHit, gradeScore, starsFromAccuracy, type HitGrade } from '../../audio/timing'

export type HitRecord = {
  expectedSec: number
  tapSec: number | null
  errorMs: number | null
  grade: HitGrade
  earlyLate: 'early' | 'late' | 'on' | 'miss'
}

export type SessionScore = {
  hits: HitRecord[]
  score: number
  accuracy: number
  combo: number
  maxCombo: number
  stars: 0 | 1 | 2 | 3
  perfect: number
  good: number
  ok: number
  miss: number
}

export function createEmptyScore(): SessionScore {
  return {
    hits: [],
    score: 0,
    accuracy: 0,
    combo: 0,
    maxCombo: 0,
    stars: 0,
    perfect: 0,
    good: 0,
    ok: 0,
    miss: 0,
  }
}

export function evaluateTap(
  expectedSec: number,
  tapSec: number,
  offsetMs: number,
): HitRecord {
  const errorMs = (tapSec - expectedSec) * 1000
  const grade = gradeHit(errorMs, offsetMs)
  const adjusted = errorMs - offsetMs
  let earlyLate: HitRecord['earlyLate'] = 'on'
  if (grade === 'miss') earlyLate = 'miss'
  else if (adjusted < -8) earlyLate = 'early'
  else if (adjusted > 8) earlyLate = 'late'
  return { expectedSec, tapSec, errorMs, grade, earlyLate }
}

export function finalizeScore(hits: HitRecord[]): SessionScore {
  let score = 0
  let combo = 0
  let maxCombo = 0
  let perfect = 0
  let good = 0
  let ok = 0
  let miss = 0

  for (const hit of hits) {
    const pts = gradeScore(hit.grade)
    if (hit.grade === 'miss') {
      combo = 0
      miss++
    } else {
      combo++
      maxCombo = Math.max(maxCombo, combo)
      score += pts + Math.min(combo, 10) * 2
      if (hit.grade === 'perfect') perfect++
      else if (hit.grade === 'good') good++
      else ok++
    }
  }

  const graded = hits.length || 1
  const accuracy = Math.round(((perfect * 100 + good * 70 + ok * 40) / graded))
  return {
    hits,
    score,
    accuracy,
    combo,
    maxCombo,
    stars: starsFromAccuracy(accuracy),
    perfect,
    good,
    ok,
    miss,
  }
}

/** Match taps to expected onsets greedily in time order. */
export function matchTapsToExpected(
  expected: number[],
  taps: number[],
  offsetMs: number,
  windowMs = 160,
): HitRecord[] {
  const used = new Set<number>()
  const hits: HitRecord[] = []

  for (const exp of expected) {
    let bestIdx = -1
    let bestAbs = Infinity
    for (let i = 0; i < taps.length; i++) {
      if (used.has(i)) continue
      const err = Math.abs((taps[i] - exp) * 1000 - offsetMs)
      if (err < bestAbs) {
        bestAbs = err
        bestIdx = i
      }
    }
    if (bestIdx >= 0 && bestAbs <= windowMs) {
      used.add(bestIdx)
      hits.push(evaluateTap(exp, taps[bestIdx], offsetMs))
    } else {
      hits.push({
        expectedSec: exp,
        tapSec: null,
        errorMs: null,
        grade: 'miss',
        earlyLate: 'miss',
      })
    }
  }
  return hits
}
