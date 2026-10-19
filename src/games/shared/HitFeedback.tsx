import type { HitGrade } from '../../audio/timing'
import styles from './HitFeedback.module.css'

const LABELS: Record<HitGrade, string> = {
  perfect: 'Perfect',
  good: 'Good',
  ok: 'OK',
  miss: 'Miss',
}

type Props = {
  grade: HitGrade | null
  earlyLate?: 'early' | 'late' | 'on' | 'miss'
}

export function HitFeedback({ grade, earlyLate }: Props) {
  if (!grade) return <div className={styles.slot} aria-hidden />
  return (
    <div className={`${styles.slot} ${styles[grade]}`} key={`${grade}-${earlyLate}`}>
      <span className={styles.label}>{LABELS[grade]}</span>
      {earlyLate === 'early' || earlyLate === 'late' ? (
        <span className={styles.hint}>{earlyLate}</span>
      ) : null}
    </div>
  )
}
