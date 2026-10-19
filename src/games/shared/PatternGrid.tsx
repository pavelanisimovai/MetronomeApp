import styles from './PatternGrid.module.css'
import type { PatternStep } from '../../data/levels/types'

type Props = {
  pattern: PatternStep[]
  beatsPerBar: number
  subdivision: number
  activeIndex?: number | null
  hideHits?: boolean
  hitStates?: Array<'pending' | 'perfect' | 'good' | 'ok' | 'miss' | 'rest'>
}

export function PatternGrid({
  pattern,
  beatsPerBar,
  subdivision,
  activeIndex = null,
  hideHits = false,
  hitStates,
}: Props) {
  const cellsPerBar = beatsPerBar * subdivision
  return (
    <div className={styles.wrap} style={{ ['--cells' as string]: cellsPerBar }}>
      {pattern.map((step, i) => {
        const state = hitStates?.[i]
        const classes = [
          styles.cell,
          step ? styles.hit : styles.rest,
          hideHits && step ? styles.hidden : '',
          activeIndex === i ? styles.active : '',
          state ? styles[state] : '',
        ]
          .filter(Boolean)
          .join(' ')
        return <div key={i} className={classes} />
      })}
    </div>
  )
}
