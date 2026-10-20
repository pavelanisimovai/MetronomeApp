import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  bandFor,
  curriculum,
  getLevel,
  recommendedLevel,
  skillPillars,
  type LevelDef,
} from '../data/levels'
import { TapPad } from '../components/TapPad'
import { PatternGrid } from '../games/shared/PatternGrid'
import { ResultCard } from '../games/shared/ResultCard'
import { coachingFor } from '../games/shared/scoring'
import { useKeyboardTap } from '../hooks/useKeyboardTap'
import { useExercise } from '../games/session/useExercise'
import { isQuietStep } from '../games/session/timeline'
import { useSettingsStore } from '../store/settingsStore'
import { useProgressStore } from '../store/progressStore'
import { usePracticeStore } from '../store/practiceStore'
import styles from './GameSession.module.css'

export function GameSession() {
  const { levelId = '' } = useParams()
  const level = getLevel(levelId)
  if (!level)
    return (
      <div>
        <h1>Lesson not found</h1>
        <Link to="/">Back to Learn</Link>
      </div>
    )
  return <Lesson key={level.id} level={level} />
}

const instructions = {
  keep: 'Tap once with each click. First, hear the steady beat.',
  echo: 'Listen to the pattern. Copy the sounds and leave the quiet spaces empty.',
  memory: 'Listen and remember. The pattern will hide when it is your turn.',
  silent:
    'Tap with the clicks, then keep the same pace when the sound goes quiet.',
}

function Lesson({ level }: { level: LevelDef }) {
  const { phase, mode, index, count, result, live, start, pause, tap } =
    useExercise(level)
  const guidance = useSettingsStore((s) => s.guidance)
  const setGuidance = useSettingsStore((s) => s.setGuidance)
  const levels = useProgressStore((s) => s.levels)
  const practice = usePracticeStore()
  const [params] = useSearchParams()
  const inDaily =
    params.has('practice') && practice.queue[practice.index] === level.id
  const statusRef = useRef<HTMLHeadingElement>(null)
  const active = ['preparing', 'listen', 'countin', 'play'].includes(phase)
  const hiddenPattern =
    level.game === 'memory' && mode === 'attempt' && phase === 'play'
  const quiet =
    level.game === 'silent' && isQuietStep(level, Math.max(0, index))
  const total =
    level.pattern?.length ??
    level.durationBeats ??
    level.bars * level.beatsPerBar * level.subdivision
  const pattern = level.pattern ?? Array.from({ length: total }, () => 1)
  const next = recommendedLevel(levels)
  const suggested =
    next.id === level.id
      ? curriculum[curriculum.findIndex((l) => l.id === level.id) + 1]
      : next
  const title =
    phase === 'ready'
      ? 'Hear it. Then try it.'
      : phase === 'preparing'
        ? 'Getting the sound ready…'
        : phase === 'listen'
          ? 'Listen first'
          : phase === 'countin'
            ? 'Count with the clicks'
            : phase === 'play'
              ? mode === 'practice'
                ? 'Tap with the guide'
                : quiet
                  ? 'Keep tapping through silence'
                  : 'Your turn'
              : phase === 'heard'
                ? 'Ready to tap along?'
                : phase === 'practised'
                  ? 'Practice round finished'
                  : phase === 'paused'
                    ? 'Take your time'
                    : phase === 'error'
                      ? 'Let’s get the sound working'
                      : 'Your result'

  useEffect(() => {
    if (['heard', 'practised', 'done', 'paused', 'error'].includes(phase))
      statusRef.current?.focus()
  }, [phase])
  useKeyboardTap(phase === 'play', tap)
  const success = Boolean(result && result.stars > 0)
  const nextPath = inDaily
    ? practice.index + 1 < practice.queue.length
      ? `/play/${practice.queue[practice.index + 1]}?practice=1`
      : '/practice'
    : success && suggested
      ? `/play/${suggested.id}`
      : null
  const onNext = () => {
    if (inDaily) practice.advance(level.id)
  }
  return (
    <div
      className={styles.page}
      data-phase={phase}
      data-mode={mode}
      data-silence={quiet && phase === 'play'}
    >
      <header className={styles.header}>
        <Link to={inDaily ? '/practice' : '/'} className={styles.back}>
          ← {inDaily ? 'Practice session' : 'Learn'}
        </Link>
        <span className={styles.meta}>
          {inDaily
            ? `${practice.index + 1} of ${practice.queue.length}`
            : bandFor(level.difficulty).label}{' '}
          · {level.bpm} BPM
        </span>
        <h1>{level.title}</h1>
      </header>
      <section className={styles.stage} aria-label="Lesson">
        <h2
          ref={statusRef}
          tabIndex={-1}
          className={styles.instruction}
          aria-live="polite"
          aria-atomic="true"
        >
          {title}
        </h2>
        {phase === 'ready' ? (
          <>
            <p>{instructions[level.game]}</p>
            <div className={styles.steps} aria-label="Lesson steps">
              <span>1 Hear it</span>
              <span>2 Practise</span>
              <span>3 Try it</span>
            </div>
            <div className={styles.options} role="group" aria-label="Guidance">
              <button
                type="button"
                aria-pressed={guidance === 'guided'}
                onClick={() => setGuidance('guided')}
              >
                Guide me
              </button>
              <button
                type="button"
                aria-pressed={guidance === 'quick'}
                onClick={() => setGuidance('quick')}
              >
                Quick start
              </button>
            </div>
          </>
        ) : null}
        {phase === 'countin' ? (
          <div className={styles.count} aria-hidden="true">
            {count}
            <small>of {level.beatsPerBar} · tap after the count</small>
          </div>
        ) : phase !== 'done' && phase !== 'practised' ? (
          <>
            {level.game === 'silent' ? (
              <div className={styles.silencePanel}>
                <strong>
                  {active
                    ? quiet
                      ? 'Sound off — keep going'
                      : 'Sound on'
                    : 'Sound → quiet → sound'}
                </strong>
                <p>
                  {level.quietSteps
                    ? 'One missing click. Keep tapping until the sound comes back.'
                    : `${level.playBars} groups with sound, ${level.muteBars} quiet. Keep the same pace.`}
                </p>
                {index >= 0 && (
                  <span>
                    {Math.min(index + 1, total)} of {total} taps
                  </span>
                )}
              </div>
            ) : (
              <PatternGrid
                pattern={pattern}
                beatsPerBar={level.beatsPerBar}
                subdivision={level.subdivision}
                activeIndex={active ? index : null}
                hideHits={hiddenPattern}
              />
            )}
          </>
        ) : null}
        {phase === 'heard' && (
          <p>
            Hear the example again, or tap along with a practice round. Practice
            has no stars.
          </p>
        )}
        {phase === 'paused' && (
          <p>
            Your round was paused and will not count. Restart with a fresh
            count-in whenever you’re ready.
          </p>
        )}
        {phase === 'error' && (
          <p>
            Tap Restart round to try again. If you still cannot hear anything,
            open <Link to="/settings">Settings</Link> for a sound check and
            iPhone troubleshooting.
          </p>
        )}
        {phase === 'ready' && (
          <p className={styles.caption}>
            {skillPillars.find((p) => p.id === level.game)?.label} ·{' '}
            {Math.ceil((total * 60) / level.bpm / level.subdivision)} seconds of
            tapping
          </p>
        )}
      </section>
      {phase === 'done' && result ? (
        <ResultCard
          score={result}
          nextPath={result.taps ? nextPath : null}
          nextLabel={
            inDaily
              ? practice.index + 1 === practice.queue.length
                ? 'Finish session'
                : 'Next in session'
              : 'Next lesson'
          }
          onNext={onNext}
          onRetry={() => void start('attempt')}
          onPractice={() => void start('practice')}
        />
      ) : (
        <div className={styles.dock}>
          {phase === 'play' ? (
            <>
              <p className={styles.feedback} aria-hidden="true">
                {live?.feedback === 'extra'
                  ? 'One tap for each sound'
                  : live?.feedback === 'perfect'
                    ? 'Right with the beat'
                    : live?.feedback === 'good'
                      ? 'Good timing'
                      : live?.feedback === 'ok'
                        ? live.direction === 'early'
                          ? 'A little early'
                          : 'A little late'
                        : 'Tap once with each sound'}
              </p>
              <TapPad className={styles.tapPad} onTap={tap}>
                Tap
              </TapPad>
              <div className={styles.below}>
                <span>
                  {mode === 'practice' ? 'Practice · no stars' : 'Try yourself'}{' '}
                  · Space or Enter to tap
                </span>
                <button type="button" onClick={pause}>
                  Pause
                </button>
              </div>
            </>
          ) : active ? (
            <>
              <p className={styles.feedback} aria-hidden="true">
                {phase === 'listen'
                  ? 'Listen to the example'
                  : 'Keep the count going'}
              </p>
              <button type="button" className={styles.tapPad} disabled>
                {phase === 'listen'
                  ? 'Listening…'
                  : phase === 'countin'
                    ? 'Wait for your turn'
                    : 'Getting ready…'}
              </button>
              <div className={styles.below}>
                <span>Your turn begins after the count</span>
                <button type="button" onClick={pause}>
                  Pause
                </button>
              </div>
            </>
          ) : phase === 'practised' ? (
            <>
              <p>
                {result?.taps
                  ? `You matched ${result.perfect + result.good + result.ok} of ${result.hits.length} taps. Ready to try yourself?`
                  : 'Tap the large pad when you hear a sound. You can practise as often as you like.'}
              </p>
              {result && (
                <details>
                  <summary>Practice feedback</summary>
                  <p>{result.taps} taps recorded</p>
                  <p>{coachingFor(result)}</p>
                </details>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={() => void start('attempt')}
              >
                I’m ready — try myself
              </button>
              <div className={styles.actions}>
                <button type="button" onClick={() => void start('practice')}>
                  Practise again
                </button>
                <button type="button" onClick={() => void start('listen')}>
                  Listen again
                </button>
              </div>
            </>
          ) : phase === 'heard' ? (
            <>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void start('practice')}
              >
                Practise together
              </button>
              <div className={styles.actions}>
                <button type="button" onClick={() => void start('listen')}>
                  Listen again
                </button>
                <button type="button" onClick={() => void start('attempt')}>
                  I’m ready — try myself
                </button>
              </div>
            </>
          ) : phase === 'paused' || phase === 'error' ? (
            <>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void start(mode)}
              >
                Restart round
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void start('listen')}
              >
                Hear the example
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.primary}
                onClick={() =>
                  void start(guidance === 'guided' ? 'listen' : 'attempt')
                }
              >
                {guidance === 'guided'
                  ? 'Hear the example'
                  : 'Start with a count-in'}
              </button>
              <p className={styles.caption}>
                Sound on · Tap the screen or use Space / Enter during your turn.
              </p>
            </>
          )}
        </div>
      )}
      <details className={styles.help}>
        <summary>How this lesson works</summary>
        <p>
          {instructions[level.game]} A numbered count-in sets the pace before
          you tap. In practice, the guide stays visible and no result is saved.
        </p>
        <p>
          {level.game === 'memory'
            ? `During your attempt, the pattern hides. ${level.responseClick === 'none' ? 'There are no reference clicks.' : 'Only the first beat of each group clicks.'}`
            : level.game === 'echo'
              ? 'During your attempt, a steady reference click helps you keep time. Copy the example, including its rests.'
              : 'Keep the count going in your head until the round ends.'}
        </p>
        <p>
          Need help hearing? Check the volume or choose another sound in{' '}
          <Link to="/settings">Settings</Link>.
        </p>
      </details>
    </div>
  )
}
