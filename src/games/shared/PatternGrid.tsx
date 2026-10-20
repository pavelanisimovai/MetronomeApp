import styles from './PatternGrid.module.css'

type Props = {
  pattern: number[]
  beatsPerBar: number
  subdivision: number
  activeIndex?: number | null
  hideHits?: boolean
}

export function PatternGrid({
  pattern,
  beatsPerBar,
  subdivision,
  activeIndex = null,
  hideHits = false,
}: Props) {
  const cellsPerBar = beatsPerBar * subdivision
  // Reveal at most the current bar on long exercises, keeping the pad visible on small phones.
  const bar =
    activeIndex != null && activeIndex >= 0
      ? Math.floor(activeIndex / cellsPerBar)
      : 0
  const first = bar * cellsPerBar
  const cells = pattern.slice(first, first + cellsPerBar)
  if (hideHits)
    return (
      <div
        className={styles.concealed}
        role="img"
        aria-label="Pattern hidden. Remember the sounds and quiet spaces."
      >
        Keep the rhythm in your head.
      </div>
    )
  return (
    <div className={styles.group}>
      <div
        className={styles.wrap}
        style={{ ['--cells' as string]: cells.length }}
        role="img"
        aria-label={`Pattern${pattern.length > cellsPerBar ? `, group ${bar + 1}` : ''}: ${cells.map((v, i) => `${i + 1} ${v ? 'tap' : 'rest'}`).join(', ')}`}
      >
        {cells.map((step, i) => (
          <div
            key={first + i}
            aria-hidden="true"
            data-step={first + i}
            data-active={activeIndex === first + i}
            className={`${styles.cell} ${step ? styles.hit : styles.rest} ${activeIndex === first + i ? styles.active : ''}`}
          >
            <span>{i + 1}</span>
            <strong>{step ? '●' : '–'}</strong>
          </div>
        ))}
      </div>
      <p className={styles.legend}>
        ● Tap · – Stay quiet
        {pattern.length > cellsPerBar
          ? ` · Group ${bar + 1}/${Math.ceil(pattern.length / cellsPerBar)}`
          : ''}
      </p>
    </div>
  )
}
