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
  const [beatDisplay, setBeatDisplay] = useState({ current: 0, total: 0 })
  const [silenceUi, setSilenceUi] = useState<{
    active: boolean
    barInCycle: number
    playBars: number
    muteBars: number
  } | null>(null)

  const expectedRef = useRef<number[]>([])
  const tapsRef = useRef<number[]>([])
  const hitCursorRef = useRef(0)
  const liveHitsRef = useRef<HitRecord[]>([])
  const phaseRef = useRef<Phase>('ready')
  const endedRef = useRef(false)
  const timersRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)

  const nextLevelId = useMemo(() => {
    if (!level) return null
    const list = levelsFor(level.game)
    const idx = list.findIndex((l) => l.id === level.id)
    return list[idx + 1]?.id ?? null
  }, [level])

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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
    setBeatDisplay({ current: 0, total: 0 })
    setSilenceUi(null)
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

  const completeSession = useCallback(
    (hits: HitRecord[]) => {
      if (!level || endedRef.current) return
      endedRef.current = true
      clearTimers()
      metronomeEngine.stop()
      const session = finalizeScore(hits)
      setResult(session)
      phaseRef.current = 'done'
      setPhase('done')
      setProgress(1)
      if (expectedRef.current.length) {
        setBeatDisplay({
          current: expectedRef.current.length,
          total: expectedRef.current.length,
        })
      }
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
      if (!expected.length) return

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
      hitCursorRef.current = cursor
      if (cursor >= expected.length) return
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
      if (hit.grade === 'perfect' || hit.grade === 'good') haptic('light')
    },
    [haptic, latencyOffsetMs],
  )

  const startKeepOrSilent = useCallback(async () => {
    if (!level) return
    endedRef.current = false
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
    const step = beatDurationSec(level.bpm) / level.subdivision
    const target =
      level.durationBeats ?? level.bars * level.beatsPerBar * level.subdivision
    // Must match MetronomeEngine.start() lead-in (0.06s)
    const startAt = ctx.currentTime + 0.06
    const expected = Array.from({ length: target }, (_, i) => startAt + i * step)
    expectedRef.current = expected
    tapsRef.current = []
    hitCursorRef.current = 0
    liveHitsRef.current = []
    phaseRef.current = 'playing'
    setPhase('playing')
    setProgress(0)
    setBeatDisplay({ current: 0, total: target })

    await metronomeEngine.start(0)

    const wallStart = performance.now()
    const durationMs = step * target * 1000

    const playBars = level.playBars ?? 1
    const muteBars = level.muteBars ?? 1
    const stepsPerBar = level.beatsPerBar * level.subdivision
    const cycle = playBars + muteBars

    const tick = () => {
      if (endedRef.current || phaseRef.current !== 'playing') return
      const audioNow = metronomeEngine.currentTime
      const wallElapsed = performance.now() - wallStart
      // Prefer audio clock; fall back to wall clock if AudioContext stalls
      const audioElapsed = Math.max(0, audioNow - startAt)
      const elapsedSec = Math.max(audioElapsed, wallElapsed / 1000)
      const idx = Math.min(target, Math.floor(elapsedSec / step) + (elapsedSec > 0 ? 1 : 0))
      setBeatDisplay({ current: Math.min(idx, target), total: target })
      setActiveIndex(Math.max(0, idx - 1))
      setProgress(Math.min(1, idx / target))

      if (level.game === 'silent' && cycle > 0 && stepsPerBar > 0) {
        const stepIndex = Math.min(target - 1, Math.max(0, idx - 1))
        const barIndex = Math.floor(stepIndex / stepsPerBar)
        const barInCycle = barIndex % cycle
        const muted = barInCycle >= playBars
        setSilenceUi({
          active: muted,
          barInCycle,
          playBars,
          muteBars,
        })
      }

      if (elapsedSec >= step * target + 0.28 || wallElapsed >= durationMs + 400) {
        finishFromLive()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    // Hard safety end even if rAF is throttled
    later(() => {
      if (!endedRef.current) finishFromLive()
    }, durationMs + 900)
  }, [finishFromLive, level, sound, volume])

  const beginRespond = useCallback(
    async (respondStart: number) => {
      if (!level?.pattern) return
      const step = beatDurationSec(level.bpm) / level.subdivision
      expectedRef.current = level.pattern
        .map((v, i) => (v ? respondStart + i * step : -1))
        .filter((t) => t >= 0)
      tapsRef.current = []
      hitCursorRef.current = 0
      liveHitsRef.current = []
      setActiveIndex(null)
      phaseRef.current = 'respond'
      setPhase('respond')
      if (level.game === 'memory') {
        setHitStates(level.pattern.map(() => 'pending'))
      }

      await metronomeEngine.ensureContext()
      const ctx = metronomeEngine.getContext()!
      const total = level.pattern.length

      for (let i = 0; i < total; i++) {
        const t = respondStart + i * step
        const isDownbeat = i % (level.beatsPerBar * level.subdivision) === 0
        if (level.game === 'echo' && i % level.subdivision === 0) {
          void metronomeEngine.playClickAt(t, isDownbeat ? 'downbeat' : 'beat')
        } else if (level.game === 'memory' && isDownbeat) {
          void metronomeEngine.playClickAt(t, 'downbeat')
        }
      }

      const wallStart = performance.now()
      const respondMs = total * step * 1000
      const respondTick = () => {
        if (endedRef.current || phaseRef.current !== 'respond') return
        const audioElapsed = Math.max(0, ctx.currentTime - respondStart)
        const wallElapsed = (performance.now() - wallStart) / 1000
        const elapsed = Math.max(audioElapsed, wallElapsed)
        const idx = Math.min(total, Math.floor(elapsed / step))
        setActiveIndex(Math.max(0, idx - 1))
        setProgress(idx / total)
        if (elapsed >= total * step + 0.3) {
          finishFromTaps()
          return
        }
        rafRef.current = requestAnimationFrame(respondTick)
      }
      rafRef.current = requestAnimationFrame(respondTick)
      later(() => {
        if (phaseRef.current === 'respond' && !endedRef.current) finishFromTaps()
      }, respondMs + 700)
    },
    [finishFromTaps, level],
  )

  const playPatternListen = useCallback(async () => {
    if (!level?.pattern) return
    await metronomeEngine.ensureContext()
    metronomeEngine.setConfig({ sound, volume })
    const ctx = metronomeEngine.getContext()!
    const step = beatDurationSec(level.bpm) / level.subdivision
    const start = ctx.currentTime + 0.15
    phaseRef.current = 'listen'
    setPhase('listen')
    setHitStates(level.pattern.map((s) => (s ? 'pending' : 'rest')))

    level.pattern.forEach((stepVal, i) => {
      const t = start + i * step
      if (stepVal) {
        const kind = i % (level.beatsPerBar * level.subdivision) === 0 ? 'downbeat' : 'beat'
        void metronomeEngine.playClickAt(t, kind)
      }
    })

    const listenMs = level.pattern.length * step * 1000
    const wallStart = performance.now()
    let handedOff = false
    const handoff = () => {
      if (handedOff || phaseRef.current !== 'listen') return
      handedOff = true
      void beginRespond(ctx.currentTime + 0.25)
    }
    const listenTick = () => {
      if (phaseRef.current !== 'listen' || handedOff) return
      const audioElapsed = Math.max(0, ctx.currentTime - start)
      const wallElapsed = (performance.now() - wallStart) / 1000
      const elapsed = Math.max(audioElapsed, wallElapsed)
      const idx = Math.min(level.pattern!.length, Math.floor(elapsed / step) + 1)
      setActiveIndex(Math.max(0, idx - 1))
      if (elapsed >= level.pattern!.length * step + 0.35) {
        handoff()
        return
      }
      rafRef.current = requestAnimationFrame(listenTick)
    }
    rafRef.current = requestAnimationFrame(listenTick)
    later(handoff, listenMs + 450)
  }, [beginRespond, level, sound, volume])

  const startCountdown = useCallback(() => {
    if (phaseRef.current !== 'ready') return
    phaseRef.current = 'countdown'
    setPhase('countdown')
    setCountdown(3)
    let n = 3
    const tick = () => {
      n -= 1
      setCountdown(Math.max(0, n))
      if (n <= 0) {
        if (level?.game === 'keep' || level?.game === 'silent') void startKeepOrSilent()
        else void playPatternListen()
      } else {
        later(tick, 650)
      }
    }
    later(tick, 650)
  }, [level, playPatternListen, startKeepOrSilent])

  const onTap = useCallback(() => {
    if (!level) return
    if (phaseRef.current === 'ready') {
      startCountdown()
      return
    }
    if (phaseRef.current !== 'playing' && phaseRef.current !== 'respond') return
    const ctx = metronomeEngine.getContext()
    if (!ctx) return
    const tapSec = ctx.currentTime
    tapsRef.current.push(tapSec)
    registerLiveTap(tapSec)
  }, [level, registerLiveTap, startCountdown])

  useKeyboardTap(
    phase === 'playing' || phase === 'respond' || phase === 'ready',
    onTap,
  )

  if (!level) {
    return (
      <div className={styles.page}>
        <h1>Level not found</h1>
        <Link to="/">Back to Train</Link>
      </div>
    )
  }

  const isSilentLevel = level.game === 'silent'
  const inSilence = Boolean(silenceUi?.active && phase === 'playing')
  const phaseLabel =
    phase === 'listen'
      ? 'Listen'
      : phase === 'respond'
        ? 'Your turn'
        : phase === 'countdown'
          ? 'Get ready'
          : phase === 'playing'
            ? isSilentLevel
              ? inSilence
                ? 'Silence — keep tapping'
                : 'Click on'
              : 'Tap the pulse'
            : phase === 'done'
              ? 'Results'
              : 'Ready'

  const playBars = level.playBars ?? 1
  const muteBars = level.muteBars ?? 1
  const cycleBars = playBars + muteBars
  const timeline = Array.from({ length: cycleBars }, (_, i) => i < playBars)

  return (
    <div className={styles.page} data-silence={inSilence ? 'true' : 'false'}>
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

      {isSilentLevel ? (
        <div className={styles.silencePanel} data-active={inSilence ? 'true' : 'false'}>
          <div className={styles.silenceMeta}>
            <div className={styles.silenceBadge} aria-live="polite">
              {phase === 'playing' ? (inSilence ? 'Silence' : 'Sound') : 'Pattern'}
            </div>
            <div className={styles.legend}>
              <span>
                <i className={styles.legendSound} /> Sound
              </span>
              <span>
                <i className={styles.legendSilence} /> Silence
              </span>
            </div>
          </div>

          <div
            className={styles.boxTrack}
            role="img"
            aria-label={`${playBars} sound bar${playBars === 1 ? '' : 's'}, ${muteBars} silence bar${
              muteBars === 1 ? '' : 's'
            }`}
          >
            {timeline.map((isClick, i) => {
              const current =
                silenceUi && phase === 'playing' && silenceUi.barInCycle === i
              const past =
                silenceUi && phase === 'playing' && silenceUi.barInCycle > i
              return (
                <div
                  key={i}
                  className={[
                    styles.box,
                    isClick ? styles.boxSound : styles.boxSilence,
                    current ? styles.boxCurrent : '',
                    past ? styles.boxPast : '',
                    phase !== 'playing' ? styles.boxPreview : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )
            })}
          </div>

          <div className={styles.silenceFooter}>
            <span>
              {beatDisplay.current}/{beatDisplay.total || level.durationBeats || 16}
            </span>
            <span>
              {phase === 'playing'
                ? inSilence
                  ? 'Yellow = keep tapping, no click'
                  : 'Teal = click is on'
                : `${playBars} sound · ${muteBars} silence`}
            </span>
          </div>
        </div>
      ) : null}

      {level.pattern ? (
        <PatternGrid
          pattern={level.pattern}
          beatsPerBar={level.beatsPerBar}
          subdivision={level.subdivision}
          activeIndex={activeIndex}
          hideHits={level.game === 'memory' && phase === 'respond'}
          hitStates={hitStates}
        />
      ) : isSilentLevel ? null : (
        <div className={styles.pulseStage} data-active={phase === 'playing'}>
          <div className={styles.pulseRing} />
          <div className={styles.pulseCore}>
            {beatDisplay.current}/{beatDisplay.total || level.durationBeats || 16}
          </div>
        </div>
      )}

      <HitFeedback grade={liveGrade} earlyLate={earlyLate} />

      {phase === 'countdown' ? <div className={styles.countdown}>{countdown || 'Go'}</div> : null}

      {phase !== 'done' ? (
        <button
          type="button"
          className={`${styles.tapPad} ${inSilence ? styles.tapPadSilent : ''}`}
          onPointerDown={(e) => {
            e.preventDefault()
            onTap()
          }}
        >
          {phase === 'ready'
            ? 'Tap to start'
            : phase === 'listen'
              ? 'Listening…'
              : inSilence
                ? 'Tap through silence'
                : 'Tap'}
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
