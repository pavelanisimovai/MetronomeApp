import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { metronomeEngine } from '../audio/MetronomeEngine'
import { beatDurationSec } from '../audio/timing'
import { getLevel, levelsFor } from '../data/levels'
import { GameHud } from '../games/shared/GameHud'
import { HitFeedback } from '../games/shared/HitFeedback'
import { PatternGrid } from '../games/shared/PatternGrid'
import { ResultCard } from '../games/shared/ResultCard'
import {
  evaluateTap,
  finalizeScore,
  matchTapsToExpected,
  type HitRecord,
  type SessionScore,
} from '../games/shared/scoring'
import { useHaptics } from '../hooks/useHaptics'
import { useKeyboardTap } from '../hooks/useKeyboardTap'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'
import styles from './GameSession.module.css'

type Phase = 'ready' | 'countdown' | 'listen' | 'respond' | 'playing' | 'done'

export function GameSession() {
  const { levelId = '' } = useParams()
  const level = getLevel(levelId)
  const latencyOffsetMs = useSettingsStore((s) => s.latencyOffsetMs)
  const sound = useSettingsStore((s) => s.sound)
  const volume = useSettingsStore((s) => s.volume)
  const recordResult = useProgressStore((s) => s.recordResult)
  const haptic = useHaptics()

  const [phase, setPhase] = useState<Phase>('ready')
  const [countdown, setCountdown] = useState(3)
  const [liveGrade, setLiveGrade] = useState<HitRecord['grade'] | null>(null)
  const [earlyLate, setEarlyLate] = useState<HitRecord['earlyLate']>('on')
  const [combo, setCombo] = useState(0)
  const [scorePts, setScorePts] = useState(0)
  const [progress, setProgress] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [result, setResult] = useState<SessionScore | null>(null)
  const [hitStates, setHitStates] = useState<
    Array<'pending' | 'perfect' | 'good' | 'ok' | 'miss' | 'rest'>
  >([])

  const expectedRef = useRef<number[]>([])
  const tapsRef = useRef<number[]>([])
  const hitCursorRef = useRef(0)
  const liveHitsRef = useRef<HitRecord[]>([])
  const phaseRef = useRef<Phase>('ready')
  const endedRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const nextLevelId = useMemo(() => {
    if (!level) return null
    const list = levelsFor(level.game)
    const idx = list.findIndex((l) => l.id === level.id)
    return list[idx + 1]?.id ?? null
  }, [level])

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const resetSession = useCallback(() => {
    clearTimers()
    metronomeEngine.stop()
    setPhase('ready')
    setCountdown(3)
    setLiveGrade(null)
    setEarlyLate('on')
    setCombo(0)
    setScorePts(0)
    setProgress(0)
    setActiveIndex(null)
    setResult(null)
    setHitStates([])
    expectedRef.current = []
    tapsRef.current = []
    hitCursorRef.current = 0
    liveHitsRef.current = []
    endedRef.current = false
  }, [])

  useEffect(() => {
    resetSession()
    return () => {
      clearTimers()
      metronomeEngine.stop()
    }
  }, [levelId, resetSession])

  const buildKeepExpected = useCallback(
    (start: number) => {
      if (!level) return []
      const step = beatDurationSec(level.bpm) / level.subdivision
      const count = level.durationBeats ?? level.bars * level.beatsPerBar * level.subdivision
      return Array.from({ length: count }, (_, i) => start + i * step)
    },
    [level],
  )

  const buildPatternExpected = useCallback(
    (start: number) => {
      if (!level?.pattern) return []
      const step = beatDurationSec(level.bpm) / level.subdivision
      return level.pattern
        .map((v, i) => (v ? start + i * step : -1))
        .filter((t) => t >= 0)
    },
    [level],
  )

  const completeSession = useCallback(
    (hits: HitRecord[]) => {
      if (!level || endedRef.current) return
      endedRef.current = true
      metronomeEngine.stop()
      const session = finalizeScore(hits)
      setResult(session)
      setPhase('done')
      setProgress(1)
      recordResult(level.id, session.score, session.accuracy, session.stars)
      if (level.pattern) {
        let expIdx = 0
        setHitStates(
          level.pattern.map((step) => {
            if (!step) return 'rest'
            return hits[expIdx++]?.grade ?? 'miss'
          }),
        )
      }
    },
    [level, recordResult],
  )

  const finishFromTaps = useCallback(() => {
    const hits = matchTapsToExpected(expectedRef.current, tapsRef.current, latencyOffsetMs)
    completeSession(hits)
  }, [completeSession, latencyOffsetMs])

  const finishFromLive = useCallback(() => {
    while (hitCursorRef.current < expectedRef.current.length) {
      liveHitsRef.current.push({
        expectedSec: expectedRef.current[hitCursorRef.current],
        tapSec: null,
        errorMs: null,
        grade: 'miss',
        earlyLate: 'miss',
      })
      hitCursorRef.current++
    }
    completeSession(liveHitsRef.current)
  }, [completeSession])

  const registerLiveTap = useCallback(
    (tapSec: number) => {
      const expected = expectedRef.current
      let cursor = hitCursorRef.current
      while (cursor < expected.length && expected[cursor] < tapSec - 0.18) {
        liveHitsRef.current.push({
          expectedSec: expected[cursor],
          tapSec: null,
          errorMs: null,
          grade: 'miss',
          earlyLate: 'miss',
        })
        cursor++
      }
      if (cursor >= expected.length) {
        hitCursorRef.current = cursor
        return
      }
      if (tapSec < expected[cursor] - 0.16) return

      const hit = evaluateTap(expected[cursor], tapSec, latencyOffsetMs)
      liveHitsRef.current.push(hit)
      hitCursorRef.current = cursor + 1
      setLiveGrade(hit.grade)
      setEarlyLate(hit.earlyLate)
      setCombo((c) => (hit.grade === 'miss' ? 0 : c + 1))
      setScorePts(
        (s) =>
          s +
          (hit.grade === 'perfect' ? 100 : hit.grade === 'good' ? 70 : hit.grade === 'ok' ? 40 : 0),
      )
      setProgress(hitCursorRef.current / expected.length)
      if (hit.grade === 'perfect' || hit.grade === 'good') haptic('light')
      if (hitCursorRef.current >= expected.length) {
        later(() => finishFromLive(), 180)
      }
    },
    [finishFromLive, haptic, latencyOffsetMs],
  )

  const startKeepOrSilent = useCallback(async () => {
    if (!level) return
    await metronomeEngine.ensureContext()
    metronomeEngine.setConfig({
      bpm: level.bpm,
      timeSignature: { beats: level.beatsPerBar, noteValue: 4 },
      subdivision: level.subdivision,
      sound,
      volume,
      accentDownbeat: true,
      audibleSubdivisions: level.subdivision > 1,
      mutedBars:
        level.game === 'silent'
          ? { play: level.playBars ?? 1, mute: level.muteBars ?? 1 }
          : null,
    })
    const ctx = metronomeEngine.getContext()!
    const start = ctx.currentTime + 0.08
    expectedRef.current = buildKeepExpected(start)
    tapsRef.current = []
    hitCursorRef.current = 0
    liveHitsRef.current = []
    setPhase('playing')
    await metronomeEngine.start(0)

    const unsub = metronomeEngine.onBeat((ev) => {
      const step = beatDurationSec(level.bpm) / level.subdivision
      const idx = Math.round((ev.audioTime - start) / step)
      setActiveIndex(idx)
      setProgress(Math.min(1, (idx + 1) / Math.max(1, expectedRef.current.length)))
    })

    const last = expectedRef.current[expectedRef.current.length - 1] ?? start
    later(() => {
      unsub()
      finishFromLive()
    }, (last - ctx.currentTime) * 1000 + 420)
  }, [buildKeepExpected, finishFromLive, level, sound, volume])

  const beginRespond = useCallback(
    async (respondStart: number) => {
      if (!level?.pattern) return
      expectedRef.current = buildPatternExpected(respondStart)
      tapsRef.current = []
      hitCursorRef.current = 0
      liveHitsRef.current = []
      setActiveIndex(null)
      setPhase('respond')
      if (level.game === 'memory') {
        setHitStates(level.pattern.map(() => 'pending'))
      }

      await metronomeEngine.ensureContext()
      const ctx = metronomeEngine.getContext()!
      const step = beatDurationSec(level.bpm) / level.subdivision
      const total = level.pattern.length

      for (let i = 0; i < total; i++) {
        const t = respondStart + i * step
        const isDownbeat = i % (level.beatsPerBar * level.subdivision) === 0
        if (level.game === 'echo' && i % level.subdivision === 0) {
          void metronomeEngine.playClickAt(t, isDownbeat ? 'downbeat' : 'beat')
        } else if (level.game === 'memory' && isDownbeat) {
          void metronomeEngine.playClickAt(t, 'downbeat')
        }
        later(() => {
          if (phaseRef.current === 'respond') {
            setActiveIndex(i)
            setProgress((i + 1) / total)
          }
        }, Math.max(0, (t - ctx.currentTime) * 1000))
      }

      later(() => {
        if (phaseRef.current === 'respond') finishFromTaps()
      }, (respondStart + total * step - ctx.currentTime) * 1000 + 300)
    },
    [buildPatternExpected, finishFromTaps, level],
  )

  const playPatternListen = useCallback(async () => {
    if (!level?.pattern) return
    await metronomeEngine.ensureContext()
    metronomeEngine.setConfig({ sound, volume })
    const ctx = metronomeEngine.getContext()!
    const step = beatDurationSec(level.bpm) / level.subdivision
    const start = ctx.currentTime + 0.12
    setPhase('listen')
    setHitStates(level.pattern.map((s) => (s ? 'pending' : 'rest')))

    level.pattern.forEach((stepVal, i) => {
      const t = start + i * step
      later(() => setActiveIndex(i), (t - ctx.currentTime) * 1000)
      if (stepVal) {
        const kind = i % (level.beatsPerBar * level.subdivision) === 0 ? 'downbeat' : 'beat'
        void metronomeEngine.playClickAt(t, kind)
      }
    })

    later(() => {
      void beginRespond(start + level.pattern!.length * step + 0.4)
    }, level.pattern.length * step * 1000 + 380)
  }, [beginRespond, level, sound, volume])

  const startCountdown = useCallback(() => {
    setPhase('countdown')
    setCountdown(3)
    let n = 3
    const tick = () => {
      n -= 1
      setCountdown(n)
      if (n <= 0) {
        if (level?.game === 'keep' || level?.game === 'silent') void startKeepOrSilent()
        else void playPatternListen()
      } else {
        later(tick, 700)
      }
    }
    later(tick, 700)
  }, [level, playPatternListen, startKeepOrSilent])

  const onTap = useCallback(() => {
    if (!level) return
    if (phase === 'ready') {
      startCountdown()
      return
    }
    if (phase !== 'playing' && phase !== 'respond') return
    const ctx = metronomeEngine.getContext()
    if (!ctx) return
    const tapSec = ctx.currentTime
    tapsRef.current.push(tapSec)
    registerLiveTap(tapSec)
  }, [level, phase, registerLiveTap, startCountdown])

  useKeyboardTap(phase === 'playing' || phase === 'respond' || phase === 'ready', onTap)

  if (!level) {
    return (
      <div className={styles.page}>
        <h1>Level not found</h1>
        <Link to="/">Back to Train</Link>
      </div>
    )
  }

  const phaseLabel =
    phase === 'listen'
      ? 'Listen'
      : phase === 'respond'
        ? 'Your turn'
        : phase === 'countdown'
          ? 'Get ready'
          : phase === 'playing'
            ? level.game === 'silent'
              ? 'Keep tapping'
              : 'Tap the pulse'
            : phase === 'done'
              ? 'Results'
              : 'Ready'

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/" className={styles.back}>
          ← Train
        </Link>
      </div>

      <GameHud
        title={level.title}
        bpm={level.bpm}
        score={result?.score ?? scorePts}
        combo={result?.maxCombo ?? combo}
        progress={progress}
        phaseLabel={phaseLabel}
      />

      <p className={styles.desc}>{level.description}</p>

      {level.pattern ? (
        <PatternGrid
          pattern={level.pattern}
          beatsPerBar={level.beatsPerBar}
          subdivision={level.subdivision}
          activeIndex={activeIndex}
          hideHits={level.game === 'memory' && phase === 'respond'}
          hitStates={hitStates}
        />
      ) : (
        <div className={styles.pulseStage} data-active={phase === 'playing'}>
          <div className={styles.pulseRing} />
          <div className={styles.pulseCore}>
            {level.beatsPerBar}/{4}
          </div>
        </div>
      )}

      <HitFeedback grade={liveGrade} earlyLate={earlyLate} />

      {phase === 'countdown' ? <div className={styles.countdown}>{countdown || 'Go'}</div> : null}

      {phase !== 'done' ? (
        <button
          type="button"
          className={styles.tapPad}
          onPointerDown={(e) => {
            e.preventDefault()
            onTap()
          }}
        >
          {phase === 'ready' ? 'Tap to start' : phase === 'listen' ? 'Listening…' : 'Tap'}
        </button>
      ) : null}

      {result ? (
        <ResultCard
          score={result}
          levelId={level.id}
          nextLevelId={nextLevelId}
          onRetry={resetSession}
        />
      ) : (
        <p className={styles.hint}>
          Windows: Perfect ≤40ms · Good ≤90ms · OK ≤150ms. Adjust latency in Settings if needed.
        </p>
      )}
    </div>
  )
}
