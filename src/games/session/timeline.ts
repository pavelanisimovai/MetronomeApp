import type { LevelDef } from '../../data/levels/types.ts'
import type { ClickKind } from '../../audio/sounds.ts'

export type RunMode = 'listen' | 'practice' | 'attempt'
export type Stage = 'listen' | 'countin' | 'play' | 'finished'
export type Timeline = {
  mode: RunMode
  step: number
  beat: number
  origin: number
  countAt: number
  playAt: number
  endAt: number
  total: number
  pattern: number[]
  expected: number[]
  clicks: Array<{ at: number; kind: ClickKind }>
}

export function isQuietStep(level: LevelDef, index: number): boolean {
  if (level.game !== 'silent') return false
  if (level.quietSteps) return level.quietSteps.includes(index)
  const bar = Math.floor(index / (level.beatsPerBar * level.subdivision))
  return (
    bar % ((level.playBars ?? 1) + (level.muteBars ?? 1)) >=
    (level.playBars ?? 1)
  )
}

/** All phase boundaries stay on the same musical grid, including the response count-in. */
export function createTimeline(
  level: LevelDef,
  mode: RunMode,
  origin: number,
  offsetMs = 0,
): Timeline {
  const beat = 60 / level.bpm
  const step = beat / level.subdivision
  const pattern =
    level.pattern ??
    Array.from(
      {
        length:
          level.durationBeats ??
          level.bars * level.beatsPerBar * level.subdivision,
      },
      () => 1,
    )
  const total = pattern.length
  const demoFirst =
    mode === 'listen' || (mode === 'attempt' && Boolean(level.pattern))
  const countAt = origin + (demoFirst ? total * step : 0)
  const playAt = countAt + level.beatsPerBar * beat
  const endAt =
    mode === 'listen'
      ? countAt
      : Math.max(
          playAt + total * step,
          playAt + (total - 1) * step + step * 0.45 + offsetMs / 1000 + 0.02,
        )
  const clicks: Timeline['clicks'] = []
  const kind = (i: number): ClickKind =>
    i % (level.beatsPerBar * level.subdivision) === 0
      ? 'downbeat'
      : i % level.subdivision === 0
        ? 'beat'
        : 'subdivision'
  if (demoFirst)
    pattern.forEach((hit, i) => {
      if (hit && !isQuietStep(level, i))
        clicks.push({ at: origin + i * step, kind: kind(i) })
    })
  if (mode !== 'listen') {
    for (let i = 0; i < level.beatsPerBar; i++)
      clicks.push({
        at: countAt + i * beat,
        kind: i === 0 ? 'downbeat' : 'beat',
      })
    pattern.forEach((hit, i) => {
      const accompaniment =
        level.responseClick ?? (level.game === 'memory' ? 'downbeat' : 'beat')
      const audible =
        mode === 'practice'
          ? hit && !isQuietStep(level, i)
          : level.game === 'keep' || level.game === 'silent'
            ? !isQuietStep(level, i)
            : accompaniment === 'beat'
              ? i % level.subdivision === 0
              : accompaniment === 'downbeat'
                ? i % (level.beatsPerBar * level.subdivision) === 0
                : false
      if (audible) clicks.push({ at: playAt + i * step, kind: kind(i) })
    })
  }
  return {
    mode,
    step,
    beat,
    origin,
    countAt,
    playAt,
    endAt,
    total,
    pattern,
    expected: pattern.flatMap((hit, i) => (hit ? [playAt + i * step] : [])),
    clicks,
  }
}

export function positionAt(
  timeline: Timeline,
  now: number,
): { stage: Stage; index: number; count: number } {
  if (now >= timeline.endAt) return { stage: 'finished', index: -1, count: 0 }
  if (now < timeline.countAt)
    return {
      stage: 'listen',
      index:
        now < timeline.origin
          ? -1
          : Math.floor((now - timeline.origin) / timeline.step),
      count: 0,
    }
  if (now < timeline.playAt)
    return {
      stage: 'countin',
      index: -1,
      count: Math.max(
        1,
        Math.floor((now - timeline.countAt) / timeline.beat) + 1,
      ),
    }
  return {
    stage: 'play',
    index: Math.min(
      timeline.total - 1,
      Math.floor((now - timeline.playAt) / timeline.step),
    ),
    count: 0,
  }
}

/** Map input and visuals to the audible audio timeline when the browser exposes it. */
export function audibleTime(
  ctx: AudioContext,
  performanceMs = performance.now(),
): number {
  const timestamp = ctx.getOutputTimestamp?.()
  if (
    typeof timestamp?.contextTime === 'number' &&
    typeof timestamp.performanceTime === 'number' &&
    timestamp.contextTime > 0 &&
    timestamp.performanceTime > 0
  ) {
    return (
      timestamp.contextTime + (performanceMs - timestamp.performanceTime) / 1000
    )
  }
  return ctx.currentTime
}
