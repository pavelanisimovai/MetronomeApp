import styles from './GameHud.module.css'

type Props = {
  title: string
  bpm: number
  score: number
  combo: number
  progress: number
  phaseLabel?: string
}

export function GameHud({ title, bpm, score, combo, progress, phaseLabel }: Props) {
  return (
    <header className={styles.hud}>
      <div className={styles.top}>
        <div>
          <p className={styles.kicker}>{phaseLabel ?? 'Level'}</p>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.bpm}>{bpm} BPM</div>
      </div>
      <div className={styles.stats}>
        <div>
          <span className={styles.statLabel}>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span className={styles.statLabel}>Combo</span>
          <strong>{combo}</strong>
        </div>
      </div>
      <div className={styles.bar} aria-hidden>
        <div className={styles.fill} style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
    </header>
  )
}
