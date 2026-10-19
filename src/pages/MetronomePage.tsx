import { useEffect, useRef, useState } from 'react'
import { estimateTapTempo } from '../audio/timing'
import { metronomeEngine, type Subdivision } from '../audio/MetronomeEngine'
import { listClickSounds } from '../audio/sounds'
import { useHaptics } from '../hooks/useHaptics'
import { useSettingsStore } from '../store/settingsStore'
import styles from './MetronomePage.module.css'

const SIGNATURES = [
  { beats: 2, noteValue: 4 },
  { beats: 3, noteValue: 4 },
  { beats: 4, noteValue: 4 },
  { beats: 5, noteValue: 4 },
  { beats: 6, noteValue: 8 },
  { beats: 7, noteValue: 8 },
  { beats: 9, noteValue: 8 },
  { beats: 12, noteValue: 8 },
]

const SUBS: { value: Subdivision; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
]

export function MetronomePage() {
  const settings = useSettingsStore()
  const haptic = useHaptics()
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)
  const [flash, setFlash] = useState(false)
  const [editingBpm, setEditingBpm] = useState(false)
  const [bpmDraft, setBpmDraft] = useState(String(settings.bpm))
  const tapsRef = useRef<number[]>([])

  useEffect(() => {
    metronomeEngine.setConfig({
      bpm: settings.bpm,
      timeSignature: settings.timeSignature,
      subdivision: settings.subdivision,
      sound: settings.sound,
      volume: settings.volume,
      accentDownbeat: settings.accentDownbeat,
      audibleSubdivisions: settings.audibleSubdivisions,
      mutedBars: null,
    })
  }, [
    settings.bpm,
    settings.timeSignature,
    settings.subdivision,
    settings.sound,
    settings.volume,
    settings.accentDownbeat,
    settings.audibleSubdivisions,
  ])

  useEffect(() => {
    const unsub = metronomeEngine.onBeat((ev) => {
      if (!ev.isBeat) return
      setBeat(ev.beatInBar)
      if (useSettingsStore.getState().haptics) {
        haptic(ev.isDownbeat ? 'medium' : 'light')
      }
      if (useSettingsStore.getState().screenFlash) {
        setFlash(true)
        window.setTimeout(() => setFlash(false), 80)
      }
    })
    return () => {
      unsub()
      metronomeEngine.stop()
      setRunning(false)
    }
    // Subscribe once; read settings from the store inside the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async () => {
    try {
      if (metronomeEngine.isRunning()) {
        metronomeEngine.stop()
        setRunning(false)
        return
      }
      setRunning(true)
      await metronomeEngine.start()
    } catch (err) {
      console.error('Metronome start failed', err)
      metronomeEngine.stop()
      setRunning(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        void toggle()
      } else if (e.code === 'ArrowUp') {
        useSettingsStore.getState().setBpm(useSettingsStore.getState().bpm + 1)
      } else if (e.code === 'ArrowDown') {
        useSettingsStore.getState().setBpm(useSettingsStore.getState().bpm - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onTapTempo = () => {
    const now = performance.now()
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 3000), now].slice(-6)
    const bpm = estimateTapTempo(tapsRef.current)
    if (bpm) settings.setBpm(bpm)
  }

  return (
    <div className={`${styles.page} ${flash ? styles.flash : ''}`}>
      <header className={styles.header}>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Metronome</h1>
        <p className={styles.sub}>Precise click for practice — games live under Train.</p>
      </header>

      <section className={styles.stage} aria-live="polite">
        <div className={styles.dots}>
          {Array.from({ length: settings.timeSignature.beats }, (_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${beat === i && running ? styles.dotOn : ''} ${
                i === 0 ? styles.dotAccent : ''
              }`}
            />
          ))}
        </div>

        {editingBpm ? (
          <form
            className={styles.bpmForm}
            onSubmit={(e) => {
              e.preventDefault()
              settings.setBpm(Number(bpmDraft) || settings.bpm)
              setEditingBpm(false)
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              value={bpmDraft}
              onChange={(e) => setBpmDraft(e.target.value)}
              onBlur={() => {
                settings.setBpm(Number(bpmDraft) || settings.bpm)
                setEditingBpm(false)
              }}
              aria-label="BPM"
            />
          </form>
        ) : (
          <button
            type="button"
            className={styles.bpm}
            onClick={() => {
              setBpmDraft(String(settings.bpm))
              setEditingBpm(true)
            }}
          >
            {settings.bpm}
            <span>BPM</span>
          </button>
        )}

        <input
          className={styles.slider}
          type="range"
          min={30}
          max={250}
          value={settings.bpm}
          onChange={(e) => settings.setBpm(Number(e.target.value))}
          aria-label="Tempo"
        />

        <div className={styles.nudge}>
          <button type="button" onClick={() => settings.setBpm(settings.bpm - 1)}>
            −1
          </button>
          <button type="button" onClick={onTapTempo} className={styles.tap}>
            Tap
          </button>
          <button type="button" onClick={() => settings.setBpm(settings.bpm + 1)}>
            +1
          </button>
        </div>
      </section>

      <section className={styles.controls}>
        <label>
          Time signature
          <select
            value={`${settings.timeSignature.beats}/${settings.timeSignature.noteValue}`}
            onChange={(e) => {
              const [b, n] = e.target.value.split('/').map(Number)
              settings.setTimeSignature({ beats: b, noteValue: n })
            }}
          >
            {SIGNATURES.map((s) => (
              <option key={`${s.beats}/${s.noteValue}`} value={`${s.beats}/${s.noteValue}`}>
                {s.beats}/{s.noteValue}
              </option>
            ))}
          </select>
        </label>

        <label>
          Subdivision
          <div className={styles.seg}>
            {SUBS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={settings.subdivision === s.value ? styles.segOn : ''}
                onClick={() => settings.setSubdivision(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </label>

        <label>
          Sound
          <select
            value={settings.sound}
            onChange={(e) => settings.setSound(e.target.value as typeof settings.sound)}
          >
            {listClickSounds().map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <button type="button" className={styles.play} onClick={() => void toggle()}>
        {running ? 'Stop' : 'Start'}
      </button>
      <p className={styles.hint}>Space start/stop · ↑↓ BPM</p>
    </div>
  )
}
