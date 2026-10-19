import { scheduleClick, type ClickKind, type ClickSoundId } from './sounds'
import { beatDurationSec } from './timing'

export type Subdivision = 1 | 2 | 3 | 4

export type TimeSignature = {
  beats: number
  noteValue: number
}

export type BeatEvent = {
  audioTime: number
  beatInBar: number
  bar: number
  subdivision: number
  isDownbeat: boolean
  isBeat: boolean
  muted: boolean
}

export type MetronomeConfig = {
  bpm: number
  timeSignature: TimeSignature
  subdivision: Subdivision
  sound: ClickSoundId
  volume: number
  accentDownbeat: boolean
  audibleSubdivisions: boolean
  /** When true, schedule audio but mark events muted for UI/games */
  mutedBars?: { play: number; mute: number } | null
}

type Listener = (event: BeatEvent) => void

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_SEC = 0.12

export class MetronomeEngine {
  private ctx: AudioContext | null = null
  private timerId: number | null = null
  private nextNoteTime = 0
  private currentBeat = 0
  private currentSub = 0
  private currentBar = 0
  private barCounter = 0
  private running = false
  private listeners = new Set<Listener>()
  private wakeLock: WakeLockSentinel | null = null
  private config: MetronomeConfig = {
    bpm: 100,
    timeSignature: { beats: 4, noteValue: 4 },
    subdivision: 1,
    sound: 'wood',
    volume: 0.85,
    accentDownbeat: true,
    audibleSubdivisions: true,
    mutedBars: null,
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    return this.ctx
  }

  getContext(): AudioContext | null {
    return this.ctx
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  isRunning(): boolean {
    return this.running
  }

  getConfig(): MetronomeConfig {
    return { ...this.config, timeSignature: { ...this.config.timeSignature } }
  }

  setConfig(partial: Partial<MetronomeConfig>) {
    this.config = {
      ...this.config,
      ...partial,
      timeSignature: partial.timeSignature
        ? { ...partial.timeSignature }
        : this.config.timeSignature,
    }
  }

  onBeat(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: BeatEvent) {
    for (const listener of this.listeners) listener(event)
  }

  private stepDuration(): number {
    const beat = beatDurationSec(this.config.bpm)
    return beat / this.config.subdivision
  }

  private isMutedBar(): boolean {
    const pattern = this.config.mutedBars
    if (!pattern) return false
    const cycle = pattern.play + pattern.mute
    if (cycle <= 0) return false
    const pos = this.barCounter % cycle
    return pos >= pattern.play
  }

  private scheduleNote() {
    if (!this.ctx) return
    const { timeSignature, subdivision, sound, volume, accentDownbeat, audibleSubdivisions } =
      this.config
    const isBeat = this.currentSub === 0
    const isDownbeat = isBeat && this.currentBeat === 0
    const muted = this.isMutedBar()

    let kind: ClickKind = 'subdivision'
    if (isDownbeat) kind = 'downbeat'
    else if (isBeat) kind = 'beat'

    const shouldPlay =
      !muted &&
      (isBeat || audibleSubdivisions) &&
      (kind !== 'downbeat' || accentDownbeat || true)

    if (shouldPlay) {
      const playKind: ClickKind =
        isDownbeat && accentDownbeat ? 'downbeat' : isBeat ? 'beat' : 'subdivision'
      try {
        scheduleClick(this.ctx, this.nextNoteTime, sound, playKind, volume)
      } catch (err) {
        console.error('scheduleClick failed', err)
      }
    }

    const event: BeatEvent = {
      audioTime: this.nextNoteTime,
      beatInBar: this.currentBeat,
      bar: this.currentBar,
      subdivision: this.currentSub,
      isDownbeat,
      isBeat,
      muted,
    }

    // Defer UI notification until near the audio time using setTimeout from performance clock approx
    const delayMs = Math.max(0, (this.nextNoteTime - this.ctx.currentTime) * 1000 - 4)
    window.setTimeout(() => this.emit(event), delayMs)

    this.nextNoteTime += this.stepDuration()
    this.currentSub += 1
    if (this.currentSub >= subdivision) {
      this.currentSub = 0
      this.currentBeat += 1
      if (this.currentBeat >= timeSignature.beats) {
        this.currentBeat = 0
        this.currentBar += 1
        this.barCounter += 1
      }
    }
  }

  private scheduler = () => {
    if (!this.ctx || !this.running) return
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleNote()
    }
  }

  async start(fromBar = 0) {
    const ctx = await this.ensureContext()
    // Some headless/automated browsers report running but never advance currentTime.
    // Kick the graph so the clock moves when possible.
    try {
      const kick = ctx.createGain()
      kick.gain.value = 0
      kick.connect(ctx.destination)
      kick.disconnect()
    } catch {
      // ignore
    }
    this.running = true
    this.currentBeat = 0
    this.currentSub = 0
    this.currentBar = fromBar
    this.barCounter = fromBar
    this.nextNoteTime = ctx.currentTime + 0.06
    this.scheduler()
    if (this.timerId != null) clearInterval(this.timerId)
    this.timerId = window.setInterval(this.scheduler, LOOKAHEAD_MS)
    void this.requestWakeLock()
  }

  stop() {
    this.running = false
    if (this.timerId != null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    void this.releaseWakeLock()
  }

  async toggle() {
    if (this.running) this.stop()
    else await this.start()
  }

  /** Schedule a one-shot click at an absolute AudioContext time (for pattern playback). */
  async playClickAt(audioTime: number, kind: ClickKind = 'beat') {
    const ctx = await this.ensureContext()
    scheduleClick(ctx, audioTime, this.config.sound, kind, this.config.volume)
  }

  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen')
      }
    } catch {
      // ignore
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release()
    } catch {
      // ignore
    }
    this.wakeLock = null
  }
}

export const metronomeEngine = new MetronomeEngine()
