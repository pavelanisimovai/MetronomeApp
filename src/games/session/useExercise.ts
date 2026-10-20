import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { metronomeEngine as engine } from '../../audio/MetronomeEngine'
import type { LevelDef } from '../../data/levels'
import { timingEaseFor } from '../../data/levels'
import { useSettingsStore } from '../../store/settingsStore'
import { useProgressStore } from '../../store/progressStore'
import { scoreSession, type SessionScore } from '../shared/scoring'
import {
  audibleTime,
  anchorToFirstTap,
  createTimeline,
  positionAt,
  type RunMode,
  type Timeline,
} from './timeline'

export type ExercisePhase =
  | 'ready'
  | 'preparing'
  | 'listen'
  | 'countin'
  | 'waiting'
  | 'play'
  | 'heard'
  | 'practised'
  | 'done'
  | 'paused'
  | 'error'
export function useExercise(level: LevelDef) {
  const [phase, setPhase] = useState<ExercisePhase>('ready')
  const [mode, setMode] = useState<RunMode>('listen')
  const [index, setIndex] = useState(-1)
  const [count, setCount] = useState(0)
  const [result, setResult] = useState<SessionScore | null>(null)
  const [live, setLive] = useState<SessionScore | null>(null)
  const generation = useRef(0)
  const frame = useRef<number | null>(null)
  const running = useRef(false)
  const finishPrompt = useRef<(() => void) | null>(null)
  const run = useRef<{
    timeline: Timeline
    taps: number[]
    offset: number
  } | null>(null)

  const cancel = useCallback(() => {
    generation.current++
    running.current = false
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    engine.stop()
    finishPrompt.current?.()
    window.speechSynthesis?.cancel()
  }, [])

  const pause = useCallback(() => {
    if (!running.current) return
    cancel()
    setLive(null)
    setPhase('paused')
  }, [cancel])

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [pause])
  useLayoutEffect(() => cancel, [cancel])

  const start = useCallback(
    async (nextMode: RunMode) => {
      cancel()
      const token = generation.current
      running.current = true
      setMode(nextMode)
      setPhase('preparing')
      setIndex(-1)
      setResult(null)
      setLive(null)
      run.current = null
      try {
        // Unlock audio directly from the user's action, before any demonstration/count-in.
        const ctx = await engine.ensureContext()
        if (token !== generation.current) return
        const settings = useSettingsStore.getState()
        engine.setConfig({ sound: settings.sound, volume: settings.volume })
        if (settings.spokenPrompts && 'speechSynthesis' in window) {
          await new Promise<void>((resolve) => {
            const prompt = new SpeechSynthesisUtterance(
              nextMode === 'listen'
                ? 'Listen to the rhythm.'
                : nextMode === 'practice'
                  ? 'Listen as long as you like. Your first tap starts practice.'
                  : 'Listen as long as you like. Your first tap starts the round.',
            )
            prompt.rate = 0.9
            const done = () => {
              clearTimeout(timeout)
              if (finishPrompt.current === done) finishPrompt.current = null
              resolve()
            }
            const timeout = window.setTimeout(() => {
              if (token === generation.current) window.speechSynthesis.cancel()
              done()
            }, 5000)
            finishPrompt.current = done
            prompt.onend = prompt.onerror = done
            window.speechSynthesis.speak(prompt)
          })
        }
        if (token !== generation.current) return
        const timeline = createTimeline(
          level,
          nextMode,
          ctx.currentTime + 0.2,
          settings.latencyOffsetMs,
        )
        run.current = { timeline, taps: [], offset: settings.latencyOffsetMs }
        // Schedule only the introduction. The response has no deadline until a tap.
        timeline.clicks
          .filter(
            (click) => nextMode === 'listen' || click.at < timeline.playAt,
          )
          .forEach((click) => engine.scheduleAt(click.at, click.kind))
        const example = createTimeline(level, 'listen', 0)
        const cycleDuration = example.total * example.step
        let nextExampleAt = timeline.playAt
        let previousStage = ''
        let previousIndex = -2
        let previousCount = -1
        const tick = () => {
          if (token !== generation.current) return
          if (ctx.state !== 'running') {
            pause()
            return
          }
          const now = audibleTime(ctx)
          const active = run.current!
          // Keep one example cycle scheduled ahead while waiting, without recording
          // attempts or misses. stop() cancels these sources on the first tap.
          if (nextMode !== 'listen' && !active.timeline.responseStarted) {
            if (nextExampleAt + cycleDuration < ctx.currentTime)
              nextExampleAt +=
                Math.floor((ctx.currentTime - nextExampleAt) / cycleDuration) *
                cycleDuration
            while (nextExampleAt < ctx.currentTime + 0.12) {
              for (const click of example.clicks) {
                const at = nextExampleAt + click.at
                if (at >= ctx.currentTime) engine.scheduleAt(at, click.kind)
              }
              nextExampleAt += cycleDuration
            }
          }
          const position = positionAt(
            active.timeline,
            now - (active.timeline.responseStarted ? active.offset / 1000 : 0),
          )
          if (position.stage === 'finished') {
            running.current = false
            engine.stop()
            if (nextMode === 'listen') setPhase('heard')
            else {
              const finished = scoreSession(
                active.timeline.expected,
                active.taps,
                active.offset,
                timingEaseFor(level),
                active.timeline.step,
              )
              setResult(finished)
              setLive(null)
              if (nextMode === 'attempt') {
                useProgressStore.getState().recordResult(level.id, finished)
                setPhase('done')
              } else setPhase('practised')
            }
            return
          }
          if (position.stage !== previousStage) {
            setPhase(position.stage)
            previousStage = position.stage
          }
          if (position.index !== previousIndex) {
            setIndex(position.index)
            previousIndex = position.index
          }
          if (position.count !== previousCount) {
            setCount(position.count)
            previousCount = position.count
          }
          frame.current = requestAnimationFrame(tick)
        }
        frame.current = requestAnimationFrame(tick)
      } catch {
        if (token !== generation.current) return
        cancel()
        setPhase('error')
      }
    },
    [cancel, level, pause],
  )

  const tap = useCallback(() => {
    const active = run.current
    const ctx = engine.getContext()
    if (!active || !ctx || !running.current) return
    if (ctx.state !== 'running') {
      pause()
      return
    }
    const now = audibleTime(ctx)
    const position = positionAt(
      active.timeline,
      now - (active.timeline.responseStarted ? active.offset / 1000 : 0),
    )
    if (position.stage === 'waiting') {
      engine.stop()
      active.timeline = anchorToFirstTap(active.timeline, now, active.offset)
      // The first tap supplies beat one. Do not replay it or leave preview sounds
      // queued under the response, especially in memory/silent exercises.
      for (const click of active.timeline.clicks) {
        if (
          click.at > active.timeline.expected[0] &&
          click.at > ctx.currentTime
        )
          engine.scheduleAt(click.at, click.kind)
      }
      setPhase('play')
      setIndex(positionAt(active.timeline, now - active.offset / 1000).index)
      setCount(0)
    } else if (position.stage !== 'play') return
    active.taps.push(now)
    const score = scoreSession(
      active.timeline.expected,
      active.taps,
      active.offset,
      timingEaseFor(level),
      active.timeline.step,
      now,
    )
    setLive(score)
    if (
      useSettingsStore.getState().haptics &&
      (score.feedback === 'perfect' || score.feedback === 'good')
    )
      navigator.vibrate?.(10)
  }, [level, pause])

  return { phase, mode, index, count, result, live, start, pause, tap }
}
