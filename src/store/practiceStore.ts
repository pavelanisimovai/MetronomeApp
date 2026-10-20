import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type PracticeState = {
  queue: string[]
  index: number
  start: (ids: string[]) => void
  advance: (id: string) => void
}
export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      queue: [],
      index: 0,
      start: (queue) => set({ queue, index: 0 }),
      advance: (id) =>
        set((state) =>
          state.queue[state.index] === id ? { index: state.index + 1 } : {},
        ),
    }),
    {
      name: 'mymetronome-practice',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
