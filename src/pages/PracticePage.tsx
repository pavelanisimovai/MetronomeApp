import { Link, useNavigate } from 'react-router-dom'
import { dailyDrillLevels, getLevel } from '../data/levels'
import { usePracticeStore } from '../store/practiceStore'
import { useProgressStore } from '../store/progressStore'
import styles from './TrainHub.module.css'

export function PracticePage() {
  const session = usePracticeStore()
  const levels = useProgressStore((s) => s.levels)
  const navigate = useNavigate()
  const finished =
    session.queue.length > 0 && session.index >= session.queue.length
  const active = session.queue.length > 0 && !finished
  const suggested = dailyDrillLevels(undefined, levels)
  const lessons =
    active || finished
      ? session.queue.map(getLevel).filter((l) => l != null)
      : suggested
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <Link className={styles.textLink} to="/">
          ← Learn
        </Link>
        <h1>
          {finished ? 'You made time for rhythm.' : 'Your practice session'}
        </h1>
        <p className={styles.lead}>
          {finished
            ? 'Three rounds finished. Your results are saved on this device. Come back whenever you want to practise.'
            : 'Three short lessons. Hear the example, practise together, then try yourself. You can pause between lessons.'}
        </p>
      </header>
      <ol className={styles.drillList}>
        {lessons.map((lesson, i) => (
          <li className={styles.drillItem} key={lesson.id}>
            <span className={styles.drillNum}>
              {i < session.index ? '✓' : i + 1}
            </span>
            <span>
              <strong>{lesson.title}</strong>
              <small>
                {i < session.index ? 'Round finished' : lesson.description}
              </small>
            </span>
          </li>
        ))}
      </ol>
      {active ? (
        <Link
          className={styles.cta}
          to={`/play/${session.queue[session.index]}?practice=1`}
        >
          Continue session · {session.index + 1} of {session.queue.length}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            session.start(suggested.map((l) => l.id))
            navigate(`/play/${suggested[0].id}?practice=1`)
          }}
        >
          {finished ? 'Start another session' : 'Begin first lesson'}
        </button>
      )}
      {finished && (
        <Link className={styles.textLink} to="/progress">
          See your progress →
        </Link>
      )}
    </div>
  )
}
