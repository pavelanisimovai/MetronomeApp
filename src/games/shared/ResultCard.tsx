import { Link } from 'react-router-dom'
import { coachingFor, type SessionScore } from './scoring'
import styles from './ResultCard.module.css'

type Props = {
  score: SessionScore
  nextPath: string | null
  nextLabel: string
  onNext: () => void
  onRetry: () => void
  onPractice: () => void
}
export function ResultCard({
  score,
  nextPath,
  nextLabel,
  onNext,
  onRetry,
  onPractice,
}: Props) {
  const matched = score.perfect + score.good + score.ok
  return (
    <section className={styles.card} aria-label="Round result">
      <p className={styles.kicker}>
        {!score.taps
          ? 'No taps recorded'
          : score.stars
            ? 'Rhythm matched'
            : 'Keep practising'}
      </p>
      <h2>
        {score.taps
          ? `You matched ${matched} of ${score.hits.length} taps`
          : 'Let’s try it together'}
      </h2>
      <p>{coachingFor(score)}</p>
      {score.taps > 0 && (
        <p className={styles.title} aria-label={`${score.stars} of 3 stars`}>
          {'★'.repeat(score.stars)}
          <span className={styles.emptyStars}>
            {'☆'.repeat(3 - score.stars)}
          </span>
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={!score.stars ? styles.primary : styles.secondary}
          onClick={onPractice}
        >
          Practise together
        </button>
        <button type="button" className={styles.secondary} onClick={onRetry}>
          Try again
        </button>
        {nextPath && (
          <Link className={styles.primary} to={nextPath} onClick={onNext}>
            {nextLabel}
          </Link>
        )}
        <Link className={styles.secondary} to="/">
          Back to Learn
        </Link>
      </div>
      <details>
        <summary>See timing details</summary>
        <div className={styles.grid}>
          <div>
            <span>Timing score</span>
            <strong>{score.accuracy}%</strong>
          </div>
          <div>
            <span>Extra taps</span>
            <strong>{score.extra}</strong>
          </div>
          <div>
            <span>Missed taps</span>
            <strong>{score.miss}</strong>
          </div>
          <div>
            <span>Best streak of taps</span>
            <strong>{score.maxCombo}</strong>
          </div>
        </div>
        <p>
          Timing score combines closeness to the beat and extra taps. Three
          stars need at least 92% and no extra taps. Two stars: 78%; one star:
          60%. Practise without stars whenever you like.
        </p>
      </details>
    </section>
  )
}
