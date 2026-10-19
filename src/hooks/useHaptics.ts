import { useSettingsStore } from '../store/settingsStore'

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.haptics)

  return (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    const ms = style === 'heavy' ? 30 : style === 'medium' ? 18 : 10
    navigator.vibrate(ms)
  }
}
