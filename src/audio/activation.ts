/** Safari can otherwise treat Web Audio as ambient audio and mute it in Silent Mode. */
export function requestPlaybackSession() {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession
    if (session && session.type !== 'playback') session.type = 'playback'
  } catch {
    // Optional API: older browsers still use the normal user-gesture unlock.
  }
}

/** Call directly from the user action, before any unrelated await. */
export async function resumeAudioContext(ctx: AudioContext) {
  if (ctx.state === 'running') return
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    // Safari also exposes "interrupted" after calls, backgrounding or output changes.
    await Promise.race([
      ctx.resume(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Audio did not start. Tap to try again.')),
          3000,
        )
      }),
    ])
    if (String(ctx.state) !== 'running')
      throw new Error('Audio is still paused. Tap to try again.')
  } finally {
    clearTimeout(timeout)
  }
}
