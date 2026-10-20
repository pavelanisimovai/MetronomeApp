import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreSession } from '../src/games/shared/scoring.ts'
import {
  createTimeline,
  anchorToFirstTap,
  positionAt,
  isQuietStep,
  audibleTime,
} from '../src/games/session/timeline.ts'
import {
  allLevels,
  curriculum,
  recommendedLevel,
  dailyDrillLevels,
} from '../src/data/levels/index.ts'
import { localDateKey, currentStreak } from '../src/utils/dates.ts'

const expected = [1, 2, 4]
test('a correct rhythm earns three stars; an extra rest tap cannot', () => {
  assert.equal(scoreSession(expected, [1, 2, 4]).stars, 3)
  const extra = scoreSession(expected, [1, 2, 3, 4])
  assert.equal(extra.extra, 1)
  assert.equal(extra.accuracy, 75)
  assert.ok(extra.stars < 3)
})
test('dense tapping cannot earn mastery or change earlier judgements', () => {
  const taps = Array.from({ length: 210 }, (_, i) => i / 50)
  const score = scoreSession(expected, taps)
  assert.ok(score.extra > 100)
  assert.equal(score.stars, 0)
  const first = scoreSession([1], [0.8], 0, 1, 1, 0.8)
  const final = scoreSession([1], [0.8, 1], 0, 1, 1)
  assert.equal(final.hits[0].tapSec, first.hits[0].tapSec)
  assert.equal(final.extra, 1)
})
test('positive and negative calibration apply identically to matching and grading', () => {
  for (const offset of [-200, 0, 120, 300]) {
    const score = scoreSession(
      expected,
      expected.map((t) => t + offset / 1000),
      offset,
    )
    assert.equal(score.accuracy, 100)
    assert.equal(score.extra, 0)
  }
})
test('dense subdivisions cannot match an adjacent rest inside a generous window', () => {
  const score = scoreSession([1, 1.4], [1.2], 0, 1.9, 0.2)
  assert.equal(score.extra, 1)
  assert.equal(score.miss, 2)
})
test('future targets remain pending; expired targets become misses; final/live matches agree', () => {
  const live = scoreSession(expected, [1, 2], 0, 1, 1, 2.1)
  assert.equal(live.hits.length, 2)
  assert.equal(live.miss, 0)
  const final = scoreSession(expected, [1, 2])
  assert.deepEqual(final.hits.slice(0, 2), live.hits)
  assert.equal(final.miss, 1)
})
test('missing and extra taps break combo, and no input awards no stars', () => {
  assert.equal(scoreSession([1, 2, 3], [1, 3]).maxCombo, 1)
  assert.equal(scoreSession([1, 2], [1, 1.5, 2]).maxCombo, 1)
  assert.equal(scoreSession(expected, []).stars, 0)
})
test('all 40 lessons wait indefinitely, then align the round to the first tap', () => {
  assert.equal(allLevels.length, 40)
  for (const level of allLevels) {
    const t = createTimeline(level, 'attempt', 10)
    assert.ok(
      Math.abs(t.playAt - t.countAt - (level.beatsPerBar * 60) / level.bpm) <
        1e-8,
      level.id,
    )
    assert.equal(positionAt(t, t.playAt - 0.001).stage, 'countin')
    assert.equal(positionAt(t, t.playAt).stage, 'waiting')
    assert.equal(positionAt(t, t.endAt + 3600).stage, 'waiting')
    for (const offset of [-200, 0, 120, 300]) {
      const firstTap = t.endAt + 3600.317
      const response = anchorToFirstTap(t, firstTap, offset)
      const taps = response.expected.map((time) => time + offset / 1000)
      assert.ok(Math.abs(taps[0] - firstTap) < 1e-8)
      assert.equal(positionAt(response, firstTap - offset / 1000).stage, 'play')
      for (let i = 0; i < response.total; i++)
        assert.equal(
          positionAt(response, response.playAt + i * response.step + 0.001)
            .index,
          i,
          `${level.id} step ${i}`,
        )
      assert.equal(positionAt(response, response.endAt).stage, 'finished')
      assert.equal(
        scoreSession(response.expected, taps, offset, 1, response.step)
          .accuracy,
        100,
      )
      assert.ok(response.clicks.every((click) => click.at >= response.playAt))
    }
  }
})
test('first tap counts once; later misses and extras still affect the anchored score', () => {
  const level = allLevels.find((l) => l.id === 'echo-1b')
  const timeline = anchorToFirstTap(createTimeline(level, 'attempt', 0), 100)
  const partial = scoreSession(timeline.expected, [100], 0, 1, timeline.step)
  assert.equal(partial.perfect, 1)
  assert.equal(partial.miss, 2)
  const extra = scoreSession(
    timeline.expected,
    [...timeline.expected, 100 + 2 * timeline.step],
    0,
    1,
    timeline.step,
  )
  assert.equal(extra.extra, 1)
  assert.ok(extra.stars < 3)
  const practice = createTimeline(level, 'practice', 0)
  assert.equal(positionAt(practice, 10000).stage, 'waiting')
})
test('demonstration ends without a scored response; practice includes sounding notes', () => {
  const level = allLevels.find((l) => l.id === 'echo-1b')
  const demo = createTimeline(level, 'listen', 10)
  assert.equal(demo.clicks.length, 3)
  assert.equal(positionAt(demo, demo.countAt).stage, 'finished')
  const practice = createTimeline(level, 'practice', 10)
  assert.deepEqual(
    practice.clicks.filter((c) => c.at >= practice.playAt).map((c) => c.at),
    practice.expected,
  )
})
test('Silent Recall has no answer clicks and first silence lesson omits only one click', () => {
  const memory = createTimeline(
    allLevels.find((l) => l.id === 'memory-3b'),
    'attempt',
    10,
  )
  assert.equal(memory.clicks.filter((c) => c.at >= memory.playAt).length, 0)
  const silent = allLevels.find((l) => l.id === 'silent-1a')
  assert.equal(
    Array.from({ length: silent.durationBeats }, (_, i) =>
      isQuietStep(silent, i),
    ).filter(Boolean).length,
    1,
  )
  assert.equal(isQuietStep(silent, 7), false)
})
test('audible output timestamp maps the performance clock, with unsupported-browser fallback', () => {
  assert.equal(
    audibleTime(
      {
        currentTime: 20,
        getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 1000 }),
      },
      1250,
    ),
    10.25,
  )
  assert.equal(audibleTime({ currentTime: 20 }, 1250), 20)
  assert.equal(
    audibleTime({ currentTime: 20, getOutputTimestamp: () => ({}) }, 1250),
    20,
  )
})
test('curriculum visits all foundations before advancing and ignores unverified legacy stars', () => {
  assert.equal(recommendedLevel({ 'keep-1a': { stars: 3 } }).id, 'keep-1a')
  const completed = {
    'keep-1a': { verifiedStars: 3 },
    'keep-1b': { verifiedStars: 3 },
  }
  assert.equal(recommendedLevel(completed).id, 'echo-1a')
  assert.deepEqual(
    dailyDrillLevels(undefined, completed).map((l) => l.id),
    ['echo-1a', 'echo-1b', 'memory-1a'],
  )
  assert.equal(new Set(curriculum.map((l) => l.id)).size, 40)
  assert.equal(
    curriculum.slice(0, 8).every((l) => l.difficulty === 1),
    true,
  )
})
test('streaks follow local calendar days and expire after missed days', () => {
  const date = new Date(2026, 9, 20, 0, 5)
  assert.equal(localDateKey(date), '2026-10-20')
  assert.equal(currentStreak('2026-10-19', 5, date), 5)
  assert.equal(currentStreak('2026-10-18', 5, date), 0)
  assert.equal(currentStreak(null, 5, date), 0)
})
