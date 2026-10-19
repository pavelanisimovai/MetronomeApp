import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { metronomeEngine } from '../audio/MetronomeEngine'
import { beatDurationSec } from '../audio/timing'
import { bandFor, getLevel, levelsFor, timingEaseFor } from '../data/levels'
import { HIT_WINDOWS_MS } from '../audio/timing'
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
  /** Wall-clock seconds (performance.now()/1000) — scoring clock, independent of AudioContext stalls */
  const wallNow = () => performance.now() / 1000

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

  const windowScale = level ? timingEaseFor(level) : 1

  const finishFromTaps = useCallback(() => {
    const hits = matchTapsToExpected(
      expectedRef.current,
      tapsRef.current,
      latencyOffsetMs,
      HIT_WINDOWS_MS.ok,
      windowScale,
    )
    completeSession(hits)
  }, [completeSession, latencyOffsetMs, windowScale])

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

      const windowSec = (HIT_WINDOWS_MS.ok / 1000) * windowScale + 0.04
      let cursor = hitCursorRef.current
      // Find nearest remaining expected onset within the hit window
      let best = -1
      let bestAbs = Infinity
      for (let i = cursor; i < expected.length; i++) {
        const abs = Math.abs(tapSec - expected[i])
        if (abs < bestAbs) {
          bestAbs = abs
          best = i
        }
        // Stop searching far into the future
        if (expected[i] - tapSec > windowSec) break
      }

      if (best < 0 || bestAbs > windowSec) {
        // Too early for the next note — ignore extra taps
        return
      }

      // Any skipped onsets before the matched one are misses
      while (cursor < best) {
        liveHitsRef.current.push({
          expectedSec: expected[cursor],
          tapSec: null,
          errorMs: null,
          grade: 'miss',
          earlyLate: 'miss',
        })
        cursor++
      }

      const hit = evaluateTap(expected[best], tapSec, latencyOffsetMs, windowScale)
      liveHitsRef.current.push(hit)
      hitCursorRef.current = best + 1
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
    [haptic, latencyOffsetMs, windowScale],
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

    const step = beatDurationSec(level.bpm) / level.subdivision
    const target =
      level.durationBeats ?? level.bars * level.beatsPerBar * level.subdivision
    // Score on wall clock; audio engine uses its own timeline for clicks.
    const startAt = wallNow() + 0.06
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

    const durationMs = step * target * 1000
    const playBars = level.playBars ?? 1
    const muteBars = level.muteBars ?? 1
    const stepsPerBar = level.beatsPerBar * level.subdivision
    const cycle = playBars + muteBars

    const tick = () => {
      if (endedRef.current || phaseRef.current !== 'playing') return
      const elapsedSec = Math.max(0, wallNow() - startAt)
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

      if (elapsedSec >= step * target + 0.28) {
        finishFromLive()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    later(() => {
      if (!endedRef.current) finishFromLive()
    }, durationMs + 900)
  }, [finishFromLive, level, sound, volume])

  const beginRespond = useCallback(async () => {
    if (!level?.pattern) return
    const step = beatDurationSec(level.bpm) / level.subdivision
    await metronomeEngine.ensureContext()
    const ctx = metronomeEngine.getContext()!
    const total = level.pattern.length

    tapsRef.current = []
    hitCursorRef.current = 0
    liveHitsRef.current = []
    expectedRef.current = []
    setActiveIndex(null)
    phaseRef.current = 'respond'
    setPhase('respond')
    if (level.game === 'memory') {
      setHitStates(level.pattern.map(() => 'pending'))
    }

    // Arm the clock after "Your turn" paints so visual + taps share one timeline
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (phaseRef.current !== 'respond' || endedRef.current) return

    const gap = 0.5
    const wallLead = wallNow() + gap
    const audioLead = ctx.currentTime + gap
    expectedRef.current = level.pattern
      .map((v, i) => (v ? wallLead + i * step : -1))
      .filter((t) => t >= 0)

    for (let i = 0; i < total; i++) {
      const t = audioLead + i * step
      const isDownbeat = i % (level.beatsPerBar * level.subdivision) === 0
      if (level.game === 'echo' && i % level.subdivision === 0) {
        void metronomeEngine.playClickAt(t, isDownbeat ? 'downbeat' : 'beat')
      } else if (level.game === 'memory' && isDownbeat) {
        void metronomeEngine.playClickAt(t, 'downbeat')
      }
    }

    const respondMs = total * step * 1000 + gap * 1000
    const respondTick = () => {
      if (endedRef.current || phaseRef.current !== 'respond') return
      const elapsed = Math.max(0, wallNow() - wallLead)
      const idx = Math.min(total, Math.floor(elapsed / step))
      setActiveIndex(Math.max(0, idx - 1))
      setProgress(idx / total)
      if (wallNow() >= wallLead + total * step + 0.3) {
        finishFromTaps()
        return
      }
      rafRef.current = requestAnimationFrame(respondTick)
    }
    rafRef.current = requestAnimationFrame(respondTick)
    later(() => {
      if (phaseRef.current === 'respond' && !endedRef.current) finishFromTaps()
    }, respondMs + 700)
  }, [finishFromTaps, level])

  const playPatternListen = useCallback(async () => {
    if (!level?.pattern) return
    await metronomeEngine.ensureContext()
    metronomeEngine.setConfig({ sound, volume })
    const ctx = metronomeEngine.getContext()!
    const step = beatDurationSec(level.bpm) / level.subdivision
    const audioStart = ctx.currentTime + 0.15
    const wallStart = wallNow()
    phaseRef.current = 'listen'
    setPhase('listen')
    setHitStates(level.pattern.map((s) => (s ? 'pending' : 'rest')))

    level.pattern.forEach((stepVal, i) => {
      const t = audioStart + i * step
      if (stepVal) {
        const kind = i % (level.beatsPerBar * level.subdivision) === 0 ? 'downbeat' : 'beat'
        void metronomeEngine.playClickAt(t, kind)
      }
    })

    const listenMs = level.pattern.length * step * 1000
    let handedOff = false
    const handoff = () => {
      if (handedOff || phaseRef.current !== 'listen') return
      handedOff = true
      void beginRespond()
    }
    const listenTick = () => {
      if (phaseRef.current !== 'listen' || handedOff) return
      const elapsed = Math.max(0, wallNow() - wallStart)
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
    const tapSec = wallNow()
    tapsRef.current.push(tapSec)
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
      const next = expectedRef.current[hitCursorRef.current]
      console.log('tap', {
        phase: phaseRef.current,
        tapSec,
        nextExpected: next,
        deltaMs: next != null ? (tapSec - next) * 1000 : null,
        expectedLeft: expectedRef.current.length - hitCursorRef.current,
      })
    }
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
        difficultyLabel={`Level ${level.difficulty} · ${bandFor(level.difficulty).label}`}
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

      <div className={styles.playDock}>
        <HitFeedback grade={liveGrade} earlyLate={earlyLate} />

        {phase !== 'done' ? (
          <button
            type="button"
            className={`${styles.tapPad} ${inSilence ? styles.tapPadSilent : ''} ${
              phase === 'countdown' ? styles.tapPadCountdown : ''
            }`}
            disabled={phase === 'countdown' || phase === 'listen'}
            onPointerDown={(e) => {
              e.preventDefault()
              if (phase === 'countdown' || phase === 'listen') return
              onTap()
            }}
          >
            {phase === 'ready'
              ? 'Tap to start'
              : phase === 'countdown'
                ? countdown || 'Go'
                : phase === 'listen'
                  ? 'Listening…'
                  : inSilence
                    ? 'Tap through silence'
                    : 'Tap'}
          </button>
        ) : result ? (
          <ResultCard
            score={result}
            levelId={level.id}
            nextLevelId={nextLevelId}
            onRetry={resetSession}
          />
        ) : null}

        {phase !== 'done' ? (
          <p className={styles.hint}>
            {level.difficulty <= 2
              ? 'Take your time — wide timing windows for young players. Tap with the beat!'
              : 'Windows scale with difficulty. Adjust latency in Settings if taps feel early/late.'}
          </p>
        ) : (
          <div className={styles.hintSpacer} aria-hidden />
        )}
      </div>
    </div>
  )
}
