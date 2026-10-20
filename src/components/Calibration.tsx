import { useCallback, useEffect, useRef, useState } from 'react'
import { metronomeEngine as engine } from '../audio/MetronomeEngine'
import { audibleTime } from '../games/session/timeline'
import { useSettingsStore } from '../store/settingsStore'
import { TapPad } from './TapPad'
import { useKeyboardTap } from '../hooks/useKeyboardTap'
import styles from '../pages/SettingsPage.module.css'

export function Calibration({
  onActiveChange,
}: {
  onActiveChange: (active: boolean) => void
}) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'result' | 'error'>(
    'idle',
  )
  const [beat, setBeat] = useState(-1)
  const [estimate, setEstimate] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const generation = useRef(0)
  const frame = useRef(0)
  const data = useRef<{ origin: number; errors: Map<number, number> } | null>(
    null,
  )
  const stop = useCallback(() => {
    generation.current++
    cancelAnimationFrame(frame.current)
    engine.stop()
  }, [])
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stop()
        setPhase('idle')
        onActiveChange(false)
      }
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      stop()
    }
  }, [stop, onActiveChange])
  const start = async () => {
    stop()
    const token = generation.current
    onActiveChange(true)
    setSaved(false)
    setEstimate(null)
    setBeat(-1)
    setPhase('running')
    try {
      const ctx = await engine.ensureContext()
      if (token !== generation.current) return
      const settings = useSettingsStore.getState()
      engine.setConfig({ sound: settings.sound, volume: settings.volume })
      const origin = ctx.currentTime + 0.2
      data.current = { origin, errors: new Map() }
      for (let i = 0; i < 12; i++)
        engine.scheduleAt(origin + i * 0.75, i % 4 === 0 ? 'downbeat' : 'beat')
      const tick = () => {
        if (token !== generation.current) return
        if (ctx.state !== 'running') {
          stop()
          setPhase('error')
          onActiveChange(false)
          return
        }
        const index = Math.floor((audibleTime(ctx) - origin) / 0.75)
        setBeat(index)
        if (index >= 12) {
          const errors = [...data.current!.errors.values()].sort(
            (a, b) => a - b,
          )
          const median =
            errors.length >= 6
              ? (errors[Math.floor((errors.length - 1) / 2)] +
                  errors[Math.floor(errors.length / 2)]) /
                2
              : null
          setEstimate(median === null ? null : Math.round(median / 5) * 5)
          stop()
          setPhase('result')
          onActiveChange(false)
          return
        }
        frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    } catch {
      if (token === generation.current) {
        stop()
        setPhase('error')
        onActiveChange(false)
      }
    }
  }
  const tap = () => {
    const ctx = engine.getContext()
    if (!ctx || !data.current || phase !== 'running') return
    const now = audibleTime(ctx)
    const index = Math.round((now - data.current.origin) / 0.75)
    const error = (now - data.current.origin - index * 0.75) * 1000
    if (
      index >= 4 &&
      index < 12 &&
      Math.abs(error) <= 300 &&
      !data.current.errors.has(index)
    )
      data.current.errors.set(index, error)
  }
  useKeyboardTap(phase === 'running' && beat >= 4, tap)
  return (
    <div className={styles.calibration}>
      <p className={styles.help}>
        Listen to four clicks, then tap with the next eight. This estimates your
        device and tapping delay together; it is a starting point, not a
        laboratory measurement.
      </p>
      <p role="status">
        {phase === 'running'
          ? beat < 4
            ? 'Listen to four clicks…'
            : 'Tap with each click'
          : phase === 'error'
            ? 'Sound was interrupted. Check your volume and try again.'
            : phase === 'result'
              ? estimate === null
                ? 'Not enough steady taps. Try the calibration again.'
                : saved
                  ? 'Offset saved. Try a lesson to check the feel.'
                  : `Suggested offset: ${estimate} ms`
              : 'Use the same speaker or headphones you will practise with.'}
      </p>
      {phase === 'running' ? (
        <>
          <TapPad
            onTap={tap}
            disabled={beat < 4}
            className={styles.calibrationTap}
          >
            Tap
          </TapPad>
          <button
            type="button"
            onClick={() => {
              stop()
              setPhase('idle')
              onActiveChange(false)
            }}
          >
            Cancel calibration
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => void start()}>
            {phase === 'idle' ? 'Start guided calibration' : 'Calibrate again'}
          </button>
          {estimate !== null && !saved && (
            <button
              type="button"
              onClick={() => {
                useSettingsStore
                  .getState()
                  .setLatencyOffsetMs(Math.max(-200, Math.min(300, estimate)))
                setSaved(true)
              }}
            >
              Use this offset
            </button>
          )}
        </>
      )}
    </div>
  )
}
