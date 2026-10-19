import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

const links = [
  { to: '/', label: 'Train', end: true },
  { to: '/metronome', label: 'Metronome' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
