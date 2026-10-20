import { Link } from 'react-router-dom'
import {
  difficultyBands,
  earnedStars,
  levelsForDifficulty,
  recommendedLevel,
  skillPillars,
  prerequisiteFor,
} from '../data/levels'
import { useProgressStore } from '../store/progressStore'
import styles from './TrainHub.module.css'

export function TrainHub() {
  const progress = useProgressStore()
  const next = recommendedLevel(progress.levels)
  const started = Object.values(progress.levels).some(
    (l) => l.verifiedStars !== undefined,
  )
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.brand}>MyMetronome</p>
        <h1>
          A little practice.
          <br />A steadier rhythm.
        </h1>
        <p className={styles.lead}>
          Hear it, tap along, then try it yourself. A friendly guide for your
          first beat and your next challenge.
        </p>
        <Link className={styles.cta} to={`/play/${next.id}`}>
          {started ? 'Your next lesson' : 'Learn your first beat'}
          <small>{next.title} · about a minute</small>
        </Link>
        <Link className={styles.textLink} to="/metronome">
          Just use the metronome →
        </Link>
        {started && (
          <div className={styles.heroMeta}>
            <span>{progress.activeStreak()} day practice streak</span>
            <span>{progress.totalStars()} stars earned</span>
          </div>
        )}
      </header>
      <section className={styles.practice}>
        <div>
          <h2>A short practice session</h2>
          <p>
            Three lessons, one step at a time. Replay and practise as often as
            you need.
          </p>
        </div>
        <Link className={styles.diffPlay} to="/practice">
          Start a practice session
        </Link>
      </section>
      <details className={styles.library}>
        <summary>Explore all exercises</summary>
        <p className={styles.libraryHint}>
          Choose any lesson, or follow the suggested path. Difficulty is about
          experience, not age.
        </p>
        <div className={styles.diffList}>
          {difficultyBands.map((band) => (
            <details key={band.id} className={styles.diffCard}>
              <summary>
                <div className={styles.diffSummary}>
                  <span className={styles.diffBadge}>Stage {band.id}</span>
                  <div>
                    <strong>{band.label}</strong>
                    <p>{band.blurb}</p>
                  </div>
                </div>
              </summary>
              <div className={styles.diffBody}>
                {levelsForDifficulty(band.id).map((level) => {
                  const stars = earnedStars(progress.levels[level.id])
                  const prior = prerequisiteFor(level.id)
                  return (
                    <Link
                      key={level.id}
                      to={`/play/${level.id}`}
                      className={styles.level}
                    >
                      <span>
                        {level.title}
                        <small>
                          {skillPillars.find((p) => p.id === level.game)?.label}{' '}
                          · {level.bpm} BPM
                        </small>
                        {prior && !earnedStars(progress.levels[prior.id]) && (
                          <small>Suggested first: {prior.title}</small>
                        )}
                      </span>
                      <span
                        className={styles.stars}
                        aria-label={`${stars} of 3 stars`}
                      >
                        {'★'.repeat(stars)}
                        {'☆'.repeat(3 - stars)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </details>
          ))}
        </div>
      </details>
      <p className={styles.footer}>
        Free · Works offline after your first visit · Progress stays on this
        device
      </p>
    </div>
  )
}
