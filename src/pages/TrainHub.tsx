import { Link } from 'react-router-dom'
import {
  dailyDrillLevels,
  levelsFor,
  recommendedLevel,
  skillPillars,
} from '../data/levels'
import { useProgressStore } from '../store/progressStore'
import styles from './TrainHub.module.css'

export function TrainHub() {
  const levels = useProgressStore((s) => s.levels)
  const streakDays = useProgressStore((s) => s.streakDays)
  const totalStars = useProgressStore((s) => s.totalStars)
  const skillFor = useProgressStore((s) => s.skillFor)
  const next = recommendedLevel(levels)
  const drill = dailyDrillLevels()

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Train your rhythm.</h1>
        <p className={styles.lead}>
          Leveled drills for pulse, echo, memory, and continuity — free, offline, no paywall.
        </p>
        <div className={styles.heroMeta}>
          <span>{streakDays} day streak</span>
          <span>{totalStars()} stars</span>
        </div>
        <Link className={styles.cta} to={`/play/${next.id}`}>
          Continue · {next.title}
        </Link>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Daily drill</h2>
          <p>Three short challenges — about three minutes.</p>
        </div>
        <div className={styles.drillList}>
          {drill.map((level, i) => (
            <Link key={level.id} to={`/play/${level.id}`} className={styles.drillItem}>
              <span className={styles.drillNum}>{i + 1}</span>
              <span>
                <strong>{level.title}</strong>
                <small>
                  {level.game} · {level.bpm} BPM
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Skill path</h2>
          <p>Pick a pillar and climb the levels.</p>
        </div>
        <div className={styles.pillars}>
          {skillPillars.map((pillar) => {
            const list = levelsFor(pillar.id)
            const cleared = list.filter((l) => (levels[l.id]?.stars ?? 0) > 0).length
            const skill = skillFor(pillar.id)
            return (
              <div key={pillar.id} className={styles.pillar}>
                <div className={styles.pillarTop}>
                  <div>
                    <h3>{pillar.label}</h3>
                    <p>{pillar.blurb}</p>
                  </div>
                  <strong>{skill}%</strong>
                </div>
                <div className={styles.meter}>
                  <div style={{ width: `${skill}%` }} />
                </div>
                <p className={styles.cleared}>
                  {cleared}/{list.length} levels
                </p>
                <div className={styles.levelList}>
                  {list.map((level) => {
                    const stars = levels[level.id]?.stars ?? 0
                    return (
                      <Link key={level.id} to={`/play/${level.id}`} className={styles.level}>
                        <span>{level.title}</span>
                        <span className={styles.stars}>
                          {'★'.repeat(stars)}
                          {'☆'.repeat(3 - stars)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
