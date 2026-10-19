import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClickSoundId } from '../audio/sounds'
import type { Subdivision, TimeSignature } from '../audio/MetronomeEngine'

type SettingsState = {
  bpm: number
  timeSignature: TimeSignature
  subdivision: Subdivision
  sound: ClickSoundId
  volume: number
  accentDownbeat: boolean
  audibleSubdivisions: boolean
  screenFlash: boolean
  haptics: boolean
  latencyOffsetMs: number
  reducedMotion: boolean
  setBpm: (bpm: number) => void
  setTimeSignature: (ts: TimeSignature) => void
  setSubdivision: (s: Subdivision) => void
  setSound: (s: ClickSoundId) => void
  setVolume: (v: number) => void
  setAccentDownbeat: (v: boolean) => void
  setAudibleSubdivisions: (v: boolean) => void
  setScreenFlash: (v: boolean) => void
  setHaptics: (v: boolean) => void
  setLatencyOffsetMs: (v: number) => void
  setReducedMotion: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      bpm: 100,
      timeSignature: { beats: 4, noteValue: 4 },
      subdivision: 1,
      sound: 'wood',
      volume: 0.85,
      accentDownbeat: true,
      audibleSubdivisions: true,
      screenFlash: false,
      haptics: true,
      latencyOffsetMs: 0,
      reducedMotion: false,
      setBpm: (bpm) => set({ bpm: Math.min(250, Math.max(30, Math.round(bpm))) }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setSubdivision: (subdivision) => set({ subdivision }),
      setSound: (sound) => set({ sound }),
      setVolume: (volume) => set({ volume }),
      setAccentDownbeat: (accentDownbeat) => set({ accentDownbeat }),
      setAudibleSubdivisions: (audibleSubdivisions) => set({ audibleSubdivisions }),
      setScreenFlash: (screenFlash) => set({ screenFlash }),
      setHaptics: (haptics) => set({ haptics }),
      setLatencyOffsetMs: (latencyOffsetMs) => set({ latencyOffsetMs }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    { name: 'mymetronome-settings' },
  ),
)
