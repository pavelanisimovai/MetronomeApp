import { Link } from 'react-router-dom'
import {
  dailyDrillLevels,
  difficultyBands,
  levelsFor,
  levelsForDifficulty,
  recommendedLevel,
  skillPillars,
  starsInDifficulty,
} from '../data/levels'
import { useProgressStore } from '../store/progressStore'
import styles from './TrainHub.module.css'

const gameLabel: Record<string, string> = {
  keep: 'Pulse',
  echo: 'Echo',
  memory: 'Memory',
  silent: 'Continuity',
}

export function TrainHub() {
  const levels = useProgressStore((s) => s.levels)
  const streakDays = useProgressStore((s) => s.streakDays)
  const totalStars = useProgressStore((s) => s.totalStars)
  const skillFor = useProgressStore((s) => s.skillFor)
  const next = recommendedLevel(levels)
  const drill = dailyDrillLevels(new Date(), levels)

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Train your rhythm.</h1>
        <p className={styles.lead}>
          Five difficulty levels — from tiny kid steps to pro grooves. Free, offline, no paywall.
        </p>
        <div className={styles.heroMeta}>
          <span>{streakDays} day streak</span>
          <span>{totalStars()} stars</span>
        </div>
        <Link className={styles.cta} to={`/play/${next.id}`}>
          Continue · {next.title}
          <small>
            Level {next.difficulty} · {gameLabel[next.game]}
          </small>
        </Link>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Difficulty</h2>
          <p>Start at Tiny Steps — made for kids around 5 and up.</p>
        </div>
        <div className={styles.diffList}>
          {difficultyBands.map((band) => {
            const stats = starsInDifficulty(band.id, levels)
            const list = levelsForDifficulty(band.id)
            const firstOpen =
              list.find((l) => (levels[l.id]?.stars ?? 0) < 1) ?? list[0]
            return (
              <details
                key={band.id}
                className={styles.diffCard}
                open={band.id === next.difficulty}
              >
                <summary>
                  <div className={styles.diffSummary}>
                    <span className={styles.diffBadge}>Level {band.id}</span>
                    <div>
                      <strong>{band.label}</strong>
                      <p>
                        {band.ages} · {band.blurb}
                      </p>
                    </div>
                    <span className={styles.diffStars}>
                      {stats.cleared}/{stats.total}
                    </span>
                  </div>
                </summary>
                <div className={styles.diffBody}>
                  <Link className={styles.diffPlay} to={`/play/${firstOpen.id}`}>
                    Play {firstOpen.title}
                  </Link>
                  <div className={styles.levelList}>
                    {list.map((level) => {
                      const stars = levels[level.id]?.stars ?? 0
                      return (
                        <Link key={level.id} to={`/play/${level.id}`} className={styles.level}>
                          <span>
                            <em>{gameLabel[level.game]}</em> {level.title}
                            <small>
                              {level.bpm} BPM
                              {level.durationBeats
                                ? ` · ${level.durationBeats} taps`
                                : level.pattern
                                  ? ` · ${level.pattern.filter(Boolean).length} hits`
                                  : ''}
                            </small>
                          </span>
                          <span className={styles.stars}>
                            {'★'.repeat(stars)}
                            {'☆'.repeat(3 - stars)}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Daily drill</h2>
          <p>Three short challenges from your current difficulty.</p>
        </div>
        <div className={styles.drillList}>
          {drill.map((level, i) => (
            <Link key={level.id} to={`/play/${level.id}`} className={styles.drillItem}>
              <span className={styles.drillNum}>{i + 1}</span>
              <span>
                <strong>{level.title}</strong>
                <small>
                  Level {level.difficulty} · {gameLabel[level.game]} · {level.bpm} BPM
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>By skill</h2>
          <p>Jump into one training pillar.</p>
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
                        <span>
                          L{level.difficulty} · {level.title}
                        </span>
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
