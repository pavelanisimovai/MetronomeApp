import { useRef, type ReactNode } from 'react'

/** Pointer-down gives low-latency touch input. Native click supports AT/keyboard.
 * Suppress only the compatibility click from the same pointer gesture. */
export function TapPad({
  onTap,
  disabled,
  className,
  children,
}: {
  onTap: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  const pointerAt = useRef(-Infinity)
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return
        e.preventDefault()
        pointerAt.current = performance.now()
        onTap()
      }}
      onClick={(e) => {
        if (e.detail === 0 || performance.now() - pointerAt.current > 1500)
          onTap()
        pointerAt.current = -Infinity
      }}
      onKeyDown={(e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
          e.preventDefault()
          onTap()
        }
      }}
    >
      {children}
    </button>
  )
}
