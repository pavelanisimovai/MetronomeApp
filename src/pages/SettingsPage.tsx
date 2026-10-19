import { listClickSounds } from '../audio/sounds'
import { useSettingsStore } from '../store/settingsStore'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const s = useSettingsStore()

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Settings</h1>
        <p className={styles.sub}>Stored on this device. Free for now — no account needed.</p>
      </header>

      <section className={styles.group}>
        <h2>Click</h2>
        <label>
          Sound
          <select value={s.sound} onChange={(e) => s.setSound(e.target.value as typeof s.sound)}>
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
        <Toggle
          label="Accent downbeat"
          checked={s.accentDownbeat}
          onChange={s.setAccentDownbeat}
        />
        <Toggle
          label="Audible subdivisions"
          checked={s.audibleSubdivisions}
          onChange={s.setAudibleSubdivisions}
        />
      </section>

      <section className={styles.group}>
        <h2>Feel</h2>
        <Toggle label="Haptics" checked={s.haptics} onChange={s.setHaptics} />
        <Toggle label="Screen flash on beat" checked={s.screenFlash} onChange={s.setScreenFlash} />
        <Toggle
          label="Prefer reduced motion"
          checked={s.reducedMotion}
          onChange={s.setReducedMotion}
        />
      </section>

      <section className={styles.group}>
        <h2>Latency calibration</h2>
        <p className={styles.help}>
          If hits feel early/late on your device, nudge this offset. Positive values treat your taps
          as later (common on Bluetooth headphones).
        </p>
        <label>
          Offset ({s.latencyOffsetMs} ms)
          <input
            type="range"
            min={-80}
            max={120}
            step={5}
            value={s.latencyOffsetMs}
            onChange={(e) => s.setLatencyOffsetMs(Number(e.target.value))}
          />
        </label>
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
