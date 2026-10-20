import { Link } from 'react-router-dom'
import {
  skillPillars,
  allLevels,
  levelsFor,
  earnedStars,
  recommendedLevel,
} from '../data/levels'
import { useProgressStore } from '../store/progressStore'
import styles from './ProgressPage.module.css'

export function ProgressPage() {
  const progress = useProgressStore()
  const verified = Object.entries(progress.levels).filter(
    ([, r]) => r.verifiedStars !== undefined,
  )
  const recent = progress.recentVerifiedAccuracies
  const recentAverage = recent.length
    ? Math.round(recent.reduce((sum, v) => sum + v, 0) / recent.length)
    : null
  const repeated = verified.filter(
    ([, r]) => (r.successfulAttempts ?? 0) >= 2,
  ).length
  const legacy = Object.entries(progress.levels).filter(
    ([, r]) => r.verifiedStars === undefined,
  )
  const next = recommendedLevel(progress.levels)
  return (
    <div className={styles.page}>
      <header>
        <p className={styles.brand}>MyMetronome</p>
        <h1>Progress</h1>
        <p className={styles.sub}>
          Small steps add up. Your practice stays on this device.
        </p>
      </header>
      {!verified.length ? (
        <section className={styles.empty}>
          <h2>Your first beat starts here</h2>
          <p>
            Try a lesson to see what you have learned. You can practise without
            stars first.
          </p>
          <Link to={`/play/${next.id}`}>Learn your first beat →</Link>
        </section>
      ) : (
        <>
          <section className={styles.stats} aria-label="Practice summary">
            <div>
              <span>Practice streak</span>
              <strong>{progress.activeStreak()} days</strong>
            </div>
            <div>
              <span>Stars earned</span>
              <strong>{progress.totalStars()}</strong>
            </div>
            <div>
              <span>Lessons tried</span>
              <strong>
                {verified.length}/{allLevels.length}
              </strong>
            </div>
            <div>
              <span>Recent timing score</span>
              <strong>{recentAverage ?? '—'}%</strong>
            </div>
          </section>
          <p className={styles.sub}>
            {repeated} lesson{repeated === 1 ? '' : 's'} performed successfully
            at least twice. Consistency grows with practice.
          </p>
        </>
      )}
      <section className={styles.skills}>
        <h2>Your learning path</h2>
        <p className={styles.sub}>
          Coverage shows lessons with at least one star, not a measure of your
          overall musical ability.
        </p>
        {skillPillars.map((pillar) => {
          const lessons = levelsFor(pillar.id)
          const passed = lessons.filter(
            (l) => earnedStars(progress.levels[l.id]) > 0,
          ).length
          return (
            <div key={pillar.id} className={styles.skillRow}>
              <div className={styles.skillTop}>
                <span>{pillar.label}</span>
                <strong>
                  {passed}/{lessons.length} lessons
                </strong>
              </div>
              <progress
                max={lessons.length}
                value={passed}
                aria-label={`${pillar.label} coverage`}
              />
            </div>
          )
        })}
      </section>
      <Link className={styles.next} to={`/play/${next.id}`}>
        Next step: {next.title} →
      </Link>
      {!!verified.length && (
        <section className={styles.recent}>
          <h2>Recent practice</h2>
          <div className={styles.list}>
            {verified
              .sort((a, b) =>
                b[1].lastPlayedAt.localeCompare(a[1].lastPlayedAt),
              )
              .slice(0, 12)
              .map(([id, r]) => (
                <Link className={styles.item} to={`/play/${id}`} key={id}>
                  <div>
                    <strong>
                      {allLevels.find((l) => l.id === id)?.title ?? id}
                    </strong>
                    <small>
                      {(r.successfulAttempts ?? 0) >= 2
                        ? 'Successful at least twice'
                        : 'Keep building consistency'}
                    </small>
                  </div>
                  <div className={styles.right}>
                    <span>{r.latestAccuracy}% last round</span>
                    <span
                      className={styles.stars}
                      aria-label={`${earnedStars(r)} of 3 stars`}
                    >
                      {'★'.repeat(earnedStars(r))}
                      {'☆'.repeat(3 - earnedStars(r))}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}
      {!!legacy.length && (
        <details>
          <summary>Earlier saved results ({legacy.length})</summary>
          <p>
            Your previous results are preserved. Replay these lessons to earn
            stars with the updated scoring rules.
          </p>
          <ul>
            {legacy.map(([id, r]) => (
              <li key={id}>
                {allLevels.find((l) => l.id === id)?.title ?? id}:{' '}
                {r.bestAccuracy}% previous best · {r.stars} stars
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
