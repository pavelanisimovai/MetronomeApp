import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requestPlaybackSession,
  resumeAudioContext,
} from '../src/audio/activation.ts'

function audioSession(t, value) {
  const original = Object.getOwnPropertyDescriptor(navigator, 'audioSession')
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    writable: true,
    value,
  })
  t.after(() => {
    if (original) Object.defineProperty(navigator, 'audioSession', original)
    else delete navigator.audioSession
  })
}

test('requests playback when Safari exposes an ambient audio session', (t) => {
  const session = { type: 'auto' }
  audioSession(t, session)
  requestPlaybackSession()
  assert.equal(session.type, 'playback')
})

test('unsupported or restricted audio-session APIs do not prevent playback', (t) => {
  audioSession(t, undefined)
  assert.doesNotThrow(requestPlaybackSession)
  globalThis.navigator.audioSession = {
    get type() {
      return 'auto'
    },
    set type(_) {
      throw new Error('Not supported')
    },
  }
  assert.doesNotThrow(requestPlaybackSession)
})

for (const state of ['suspended', 'interrupted']) {
  test(`resumes ${state} audio immediately within the user action`, async () => {
    let called = false
    const ctx = {
      state,
      resume() {
        called = true
        this.state = 'running'
        return Promise.resolve()
      },
    }
    const ready = resumeAudioContext(ctx)
    assert.equal(called, true)
    await ready
    assert.equal(ctx.state, 'running')
  })
}

test('a browser resume rejection reaches the retry UI', async () => {
  await assert.rejects(
    resumeAudioContext({
      state: 'suspended',
      resume: () => Promise.reject(new Error('NotAllowedError')),
    }),
    /NotAllowedError/,
  )
})

test('a resolved resume that leaves audio interrupted is not reported as ready', async () => {
  await assert.rejects(
    resumeAudioContext({
      state: 'interrupted',
      resume: () => Promise.resolve(),
    }),
    /still paused/,
  )
})

test('a stalled resume times out so the user can retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const ready = resumeAudioContext({
    state: 'suspended',
    resume: () => new Promise(() => {}),
  })
  const rejection = assert.rejects(ready, /did not start/)
  t.mock.timers.tick(3000)
  await rejection
})
