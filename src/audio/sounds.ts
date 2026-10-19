export type ClickSoundId = 'wood' | 'click' | 'beep' | 'rim'

export type ClickKind = 'downbeat' | 'beat' | 'subdivision'

const SOUND_LABELS: Record<ClickSoundId, string> = {
  wood: 'Wood block',
  click: 'Studio click',
  beep: 'Sine beep',
  rim: 'Rimshot',
}

export function listClickSounds(): { id: ClickSoundId; label: string }[] {
  return (Object.keys(SOUND_LABELS) as ClickSoundId[]).map((id) => ({
    id,
    label: SOUND_LABELS[id],
  }))
}

function playTone(
  ctx: AudioContext,
  time: number,
  freq: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, time)
  const safeGain = Math.max(0.0001, gainValue)
  const t0 = Math.max(time, ctx.currentTime)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(safeGain, t0 + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, duration))
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + duration + 0.02)
}

function playNoiseBurst(ctx: AudioContext, time: number, duration: number, gainValue: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1800, time)
  filter.Q.value = 0.7
  gain.gain.setValueAtTime(gainValue, time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(time)
  src.stop(time + duration + 0.02)
}

export function scheduleClick(
  ctx: AudioContext,
  time: number,
  sound: ClickSoundId,
  kind: ClickKind,
  volume = 0.8,
) {
  const v = Math.max(0.05, Math.min(1, volume))
  const accentBoost = kind === 'downbeat' ? 1.15 : kind === 'beat' ? 1 : 0.55

  switch (sound) {
    case 'wood':
      playTone(ctx, time, kind === 'downbeat' ? 880 : kind === 'beat' ? 660 : 440, 0.06, 0.35 * v * accentBoost, 'triangle')
      playNoiseBurst(ctx, time, 0.04, 0.18 * v * accentBoost)
      break
    case 'click':
      playTone(ctx, time, kind === 'downbeat' ? 1400 : kind === 'beat' ? 1100 : 800, 0.035, 0.28 * v * accentBoost, 'square')
      break
    case 'beep':
      playTone(ctx, time, kind === 'downbeat' ? 1000 : kind === 'beat' ? 800 : 600, 0.07, 0.3 * v * accentBoost, 'sine')
      break
    case 'rim':
      playNoiseBurst(ctx, time, kind === 'subdivision' ? 0.03 : 0.05, 0.32 * v * accentBoost)
      playTone(ctx, time, kind === 'downbeat' ? 220 : 180, 0.04, 0.2 * v * accentBoost, 'sine')
      break
  }
}
