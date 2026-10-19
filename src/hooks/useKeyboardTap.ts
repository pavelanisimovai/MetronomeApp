import { useEffect } from 'react'

/** Space / Enter trigger onTap when enabled. Ignores keys while typing in inputs. */
export function useKeyboardTap(enabled: boolean, onTap: () => void) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        onTap()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onTap])
}
