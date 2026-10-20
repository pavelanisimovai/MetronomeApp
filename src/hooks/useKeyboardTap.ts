import { useEffect } from 'react'

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'a, button, input, textarea, select, summary, [contenteditable="true"], [role="button"]',
      ),
    )
  )
}

/** Page shortcuts supplement native controls; never intercept their own activation. */
export function useKeyboardTap(enabled: boolean, onTap: () => void) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        isInteractiveTarget(e.target)
      )
        return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        onTap()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onTap])
}
