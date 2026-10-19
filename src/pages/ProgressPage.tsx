import { skillPillars, allLevels } from '../data/levels'
import { useProgressStore } from '../store/progressStore'
import styles from './ProgressPage.module.css'

export function ProgressPage() {
  const levels = useProgressStore((s) => s.levels)
  const streakDays = useProgressStore((s) => s.streakDays)
  const totalStars = useProgressStore((s) => s.totalStars)
  const recentAccuracies = useProgressStore((s) => s.recentAccuracies)
  const skillFor = useProgressStore((s) => s.skillFor)

  const avgRecent =
    recentAccuracies.length > 0
      ? Math.round(recentAccuracies.reduce((a, b) => a + b, 0) / recentAccuracies.length)
      : 0

  const played = Object.keys(levels).length

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Progress</h1>
        <p className={styles.sub}>Local-only history on this device.</p>
      </header>

      <section className={styles.stats}>
        <div>
          <span>Streak</span>
          <strong>{streakDays}d</strong>
        </div>
        <div>
          <span>Stars</span>
          <strong>{totalStars()}</strong>
        </div>
        <div>
          <span>Levels played</span>
          <strong>
            {played}/{allLevels.length}
          </strong>
        </div>
        <div>
          <span>Recent accuracy</span>
          <strong>{avgRecent}%</strong>
        </div>
      </section>

      <section className={styles.skills}>
        <h2>Skills</h2>
        {skillPillars.map((pillar) => (
          <div key={pillar.id} className={styles.skillRow}>
            <div className={styles.skillTop}>
              <span>{pillar.label}</span>
              <strong>{skillFor(pillar.id)}%</strong>
            </div>
            <div className={styles.meter}>
              <div style={{ width: `${skillFor(pillar.id)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className={styles.recent}>
        <h2>Best scores</h2>
        <div className={styles.list}>
          {Object.entries(levels)
            .sort((a, b) => b[1].bestScore - a[1].bestScore)
            .slice(0, 12)
            .map(([id, result]) => {
              const def = allLevels.find((l) => l.id === id)
              return (
                <div key={id} className={styles.item}>
                  <div>
                    <strong>{def?.title ?? id}</strong>
                    <small>{def?.game}</small>
                  </div>
                  <div className={styles.right}>
                    <span>{result.bestScore}</span>
                    <span className={styles.stars}>
                      {'★'.repeat(result.stars)}
                      {'☆'.repeat(3 - result.stars)}
                    </span>
                  </div>
                </div>
              )
            })}
          {!played ? <p className={styles.empty}>Complete a level to see scores here.</p> : null}
        </div>
      </section>
    </div>
  )
}
