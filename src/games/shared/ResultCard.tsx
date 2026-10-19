import { Link } from 'react-router-dom'
import type { SessionScore } from './scoring'
import styles from './ResultCard.module.css'

type Props = {
  score: SessionScore
  levelId: string
  nextLevelId?: string | null
  onRetry: () => void
}

export function ResultCard({ score, levelId, nextLevelId, onRetry }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.kicker}>Level complete</p>
      <h2 className={styles.title}>
        {'★'.repeat(score.stars)}
        {'☆'.repeat(3 - score.stars)}
      </h2>
      <div className={styles.grid}>
        <div>
          <span>Score</span>
          <strong>{score.score}</strong>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>{score.accuracy}%</strong>
        </div>
        <div>
          <span>Max combo</span>
          <strong>{score.maxCombo}</strong>
        </div>
        <div>
          <span>Perfect</span>
          <strong>{score.perfect}</strong>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onRetry}>
          Retry
        </button>
        {nextLevelId ? (
          <Link className={styles.primary} to={`/play/${nextLevelId}`}>
            Next level
          </Link>
        ) : (
          <Link className={styles.primary} to="/">
            Back to Train
          </Link>
        )}
        <Link className={styles.ghost} to={`/play/${levelId}`} hidden />
      </div>
    </div>
  )
}
