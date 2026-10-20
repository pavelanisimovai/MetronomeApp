import { useCallback, useEffect, useRef, useState } from 'react'
import { Calibration } from '../components/Calibration'
import { SoundHelp } from '../components/SoundHelp'
import { metronomeEngine } from '../audio/MetronomeEngine'
import { listClickSounds } from '../audio/sounds'
import { useSettingsStore } from '../store/settingsStore'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const s = useSettingsStore()
  const [soundMessage, setSoundMessage] = useState('')
  const soundToken = useRef(0)
  const [calibrating, setCalibrating] = useState(false)
  const calibrationActive = useCallback((active: boolean) => {
    soundToken.current++
    setCalibrating(active)
  }, [])
  useEffect(
    () => () => {
      soundToken.current++
      metronomeEngine.stop()
    },
    [],
  )
  const checkSound = async () => {
    const token = ++soundToken.current
    metronomeEngine.stop()
    try {
      const ctx = await metronomeEngine.ensureContext()
      if (token !== soundToken.current) return
      metronomeEngine.setConfig({ sound: s.sound, volume: s.volume })
      metronomeEngine.scheduleAt(ctx.currentTime + 0.1, 'downbeat')
      setSoundMessage(
        'Did you hear the click? If not, open “No sound?” below.',
      )
    } catch {
      if (token === soundToken.current)
        setSoundMessage(
          'Sound could not start. Tap Play a test sound again, or open “No sound?” below.',
        )
    }
  }

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Settings</h1>
        <p className={styles.sub}>
          Make practice comfortable. Settings are saved on this device.
        </p>
      </header>

      <section className={styles.group}>
        <h2>Learning guidance</h2>
        <label>
          Starting a lesson
          <select
            value={s.guidance}
            onChange={(e) =>
              s.setGuidance(e.target.value as 'guided' | 'quick')
            }
          >
            <option value="guided">Guide me — hear it first</option>
            <option value="quick">Quick start — go to the attempt</option>
          </select>
        </label>
        <Toggle
          label="Speak short instructions before the beat"
          checked={s.spokenPrompts}
          onChange={s.setSpokenPrompts}
        />
        <p className={styles.help}>
          Spoken prompts are optional and depend on voices available on your
          device. The same instructions always appear on screen.
        </p>
      </section>
      <section className={styles.group}>
        <h2>Sound check</h2>
        <label>
          Sound
          <select
            value={s.sound}
            onChange={(e) => s.setSound(e.target.value as typeof s.sound)}
          >
            {listClickSounds().map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Volume
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => s.setVolume(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className={styles.testSound}
          disabled={calibrating}
          onClick={() => void checkSound()}
        >
          Play a test sound
        </button>
        <p role="status" className={styles.help}>
          {soundMessage}
        </p>
        <SoundHelp />
        <Toggle
          label="Emphasize the first beat"
          checked={s.accentDownbeat}
          onChange={s.setAccentDownbeat}
        />
        <Toggle
          label="Play the smaller clicks between beats"
          checked={s.audibleSubdivisions}
          onChange={s.setAudibleSubdivisions}
        />
      </section>

      <section className={styles.group}>
        <h2>Feel</h2>
        <Toggle
          label="Vibrate on supported devices"
          checked={s.haptics}
          onChange={s.setHaptics}
        />
        <Toggle
          label="Screen flash on beat"
          checked={s.screenFlash}
          onChange={s.setScreenFlash}
        />
        <Toggle
          label="Prefer reduced motion"
          checked={s.reducedMotion}
          onChange={s.setReducedMotion}
        />
      </section>

      <section className={styles.group}>
        <h2>Timing calibration</h2>
        <p className={styles.help}>
          If your taps consistently feel late, try your device speaker or wired
          headphones first. Bluetooth can add delay. You can also estimate an
          offset below.
        </p>
        <Calibration onActiveChange={calibrationActive} />
        <details>
          <summary>Adjust offset manually</summary>
          <p className={styles.help}>
            Positive values compensate for taps arriving late. Recheck after
            changing headphones. Your first tap sets the timing reference;
            this offset adjusts guide-click timing, not the exercise tempo.
          </p>
          <label>
            Offset ({s.latencyOffsetMs} ms)
            <input
              type="range"
              min={-200}
              max={300}
              step={5}
              value={s.latencyOffsetMs}
              aria-label="Timing offset"
              onChange={(e) => s.setLatencyOffsetMs(Number(e.target.value))}
            />
          </label>
          <button type="button" onClick={() => s.setLatencyOffsetMs(0)}>
            Reset offset to zero
          </button>
        </details>
      </section>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}
