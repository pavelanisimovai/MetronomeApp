import { useEffect } from 'react'

/** Space / Enter trigger onTap when enabled. */
export function useKeyboardTap(enabled: boolean, onTap: () => void) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        onTap()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onTap])
}
