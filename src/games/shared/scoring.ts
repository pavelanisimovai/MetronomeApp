import {
  gradeHit,
  gradeScore,
  starsFromAccuracy,
  type HitGrade,
} from '../../audio/timing.ts'

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
  extra: number
  taps: number
  feedback: HitGrade | 'extra' | null
  direction: HitRecord['earlyLate']
}

export function evaluateTap(
  expectedSec: number,
  tapSec: number,
  offsetMs: number,
  windowScale = 1,
): HitRecord {
  const errorMs = (tapSec - expectedSec) * 1000
  const grade = gradeHit(errorMs, offsetMs, windowScale)
  const adjusted = errorMs - offsetMs
  return {
    expectedSec,
    tapSec,
    errorMs,
    grade,
    earlyLate:
      grade === 'miss'
        ? 'miss'
        : adjusted < -8
          ? 'early'
          : adjusted > 8
            ? 'late'
            : 'on',
  }
}

/** Chronological, one-to-one matching. A later tap never replaces an earlier judgement.
 * Windows cannot cross the midpoint to a neighboring grid position, including rests.
 * `until` leaves future notes pending for live feedback; Infinity finalizes the round.
 */
export function scoreSession(
  expected: number[],
  taps: number[],
  offsetMs = 0,
  windowScale = 1,
  stepSec = 1,
  until = Infinity,
): SessionScore {
  const windowSec = Math.min(0.25 * Math.max(0.5, windowScale), stepSec * 0.45)
  const matched = new Map<number, HitRecord>()
  const events: Array<{ time: number; grade: HitGrade | 'extra' }> = []
  let feedback: SessionScore['feedback'] = null
  let direction: HitRecord['earlyLate'] = 'on'
  let extra = 0
  const recorded = taps
    .filter((t) => t <= until)
    .slice()
    .sort((a, b) => a - b)
  for (const tap of recorded) {
    const corrected = tap - offsetMs / 1000
    let best = -1
    let distance = Infinity
    for (let i = 0; i < expected.length; i++) {
      const delta = Math.abs(corrected - expected[i])
      if (!matched.has(i) && delta <= windowSec && delta < distance) {
        best = i
        distance = delta
      }
    }
    if (best < 0) {
      extra++
      feedback = 'extra'
      direction = 'on'
      events.push({ time: tap, grade: 'extra' })
    } else {
      const hit = evaluateTap(expected[best], tap, offsetMs, windowScale)
      matched.set(best, hit)
      feedback = hit.grade
      direction = hit.earlyLate
      events.push({ time: tap, grade: hit.grade })
    }
  }
  const hits: HitRecord[] = []
  expected.forEach((time, i) => {
    const hit = matched.get(i)
    if (hit) hits.push(hit)
    else if (time + windowSec + offsetMs / 1000 < until) {
      hits.push({
        expectedSec: time,
        tapSec: null,
        errorMs: null,
        grade: 'miss',
        earlyLate: 'miss',
      })
      events.push({ time: time + windowSec + offsetMs / 1000, grade: 'miss' })
    }
  })
  let combo = 0
  let maxCombo = 0
  for (const event of events.sort((a, b) => a.time - b.time)) {
    combo = event.grade === 'miss' || event.grade === 'extra' ? 0 : combo + 1
    maxCombo = Math.max(maxCombo, combo)
  }
  const count = (grade: HitGrade) =>
    hits.filter((h) => h.grade === grade).length
  const score = hits.reduce((sum, hit) => sum + gradeScore(hit.grade), 0)
  const accuracy = Math.round(score / Math.max(1, hits.length + extra))
  const stars = Math.min(
    starsFromAccuracy(accuracy),
    extra ? 2 : 3,
  ) as SessionScore['stars']
  return {
    hits,
    score,
    accuracy,
    combo,
    maxCombo,
    stars,
    perfect: count('perfect'),
    good: count('good'),
    ok: count('ok'),
    miss: count('miss'),
    extra,
    taps: recorded.length,
    feedback,
    direction,
  }
}

export function coachingFor(score: SessionScore): string {
  if (!score.taps)
    return 'No taps recorded. Listen again, then practise with the guide.'
  if (score.extra)
    return `${score.extra} extra tap${score.extra === 1 ? '' : 's'}. Tap once for each sound and leave the quiet spaces empty.`
  if (score.miss)
    return `You missed ${score.miss} beat${score.miss === 1 ? '' : 's'}. Try a practice round to find the pulse.`
  const errors = score.hits.flatMap((h) =>
    h.errorMs == null ? [] : [h.earlyLate],
  )
  const early = errors.filter((e) => e === 'early').length
  const late = errors.filter((e) => e === 'late').length
  if (score.accuracy < 92 && early > late)
    return 'Your taps tended to arrive early. Wait for the sound before your next tap.'
  if (score.accuracy < 92 && late > early)
    return 'Your taps tended to arrive late. Keep the count-in going in your head.'
  return 'You kept the rhythm. Try it again to build consistency, or explore the next lesson.'
}
