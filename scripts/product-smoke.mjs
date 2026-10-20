import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { allLevels } from '../src/data/levels/index.ts'

const base = process.env.APP_URL || 'http://127.0.0.1:4173'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const browser = await chromium.launch({ executablePath, headless: true })
let checks = 0
async function check(name, fn) {
  if (process.env.SMOKE_FILTER && !name.includes(process.env.SMOKE_FILTER))
    return
  await fn()
  checks++
  console.log(`PASS ${name}`)
}
async function fresh(viewport = { width: 390, height: 844 }, storage) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript((storage) => {
    if (storage)
      for (const [key, value] of Object.entries(storage))
        localStorage.setItem(key, JSON.stringify(value))
    window.__audio = []
    const original = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      window.__ctx = this
      const source = original.call(this)
      const trace = { start: null, stops: [], ended: false }
      const start = source.start.bind(source),
        stop = source.stop.bind(source)
      source.start = (time) => {
        trace.start = time
        window.__audio.push(trace)
        return start(time)
      }
      source.stop = (time) => {
        trace.stops.push(time ?? this.currentTime)
        return stop(time)
      }
      source.addEventListener('ended', () => {
        trace.ended = true
      })
      return source
    }
  }, storage)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, errors }
}
async function go(page, path) {
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}nosw=1`)
  await page.locator('h1').waitFor()
}
async function quick(page) {
  await page.getByRole('button', { name: 'Quick start', exact: true }).click()
  await page
    .getByRole('button', { name: 'Start with a count-in', exact: true })
    .click()
}
async function tapRound(page, id) {
  await page
    .getByRole('button', { name: 'Tap to start', exact: true })
    .waitFor({ timeout: 20000 })
  const level = allLevels.find((l) => l.id === id)
  const step = 60 / level.bpm / level.subdivision
  const pattern =
    level.pattern ??
    Array(
      level.durationBeats ?? level.bars * level.beatsPerBar * level.subdivision,
    ).fill(1)
  const targetSteps = pattern.flatMap((hit, index) => (hit ? [index] : []))
  const tapped = await page.evaluate(
    async ({ targetSteps, step }) => {
      const clock = () => {
        const ctx = window.__ctx
        const stamp = ctx.getOutputTimestamp?.()
        return stamp?.contextTime > 0 && stamp.performanceTime > 0
          ? stamp.contextTime +
              (performance.now() - stamp.performanceTime) / 1000
          : ctx.currentTime
      }
      const firstTap = clock()
      ;[...document.querySelectorAll('button')]
        .find((b) => b.textContent === 'Tap to start')
        .click()
      let count = 1
      await new Promise(requestAnimationFrame)
      window.__tapHighlights = []
      window.__tapHighlights.push(
        Number(
          document
            .querySelector('[data-step][data-active="true"]')
            ?.getAttribute('data-step'),
        ),
      )
      window.__silenceSeen = false
      const targets = targetSteps
        .slice(1)
        .map((index) => firstTap + index * step + 0.025)
      const deadline = performance.now() + 40000
      while (targets.length && performance.now() < deadline) {
        const now = clock()
        if (document.querySelector('[data-silence="true"]'))
          window.__silenceSeen = true
        if (now >= targets[0]) {
          const button = [...document.querySelectorAll('button')].find(
            (b) => b.textContent === 'Tap' && !b.disabled,
          )
          if (button) {
            window.__tapHighlights.push(
              Number(
                document
                  .querySelector('[data-step][data-active="true"]')
                  ?.getAttribute('data-step'),
              ),
            )
            button.click()
            count++
            targets.shift()
          }
        }
        await new Promise(requestAnimationFrame)
      }
      return count
    },
    { targetSteps, step },
  )
  assert.equal(tapped, targetSteps.length, `${id}: all target taps dispatched`)
  if (level.game === 'keep' || level.game === 'echo')
    assert.deepEqual(
      await page.evaluate(() => window.__tapHighlights),
      targetSteps,
      `${id}: visible beat matches audio`,
    )
  if (level.game === 'silent')
    assert.equal(
      await page.evaluate(() => window.__silenceSeen),
      true,
      'quiet phase is visible',
    )
  await page
    .getByRole('region', { name: 'Round result' })
    .waitFor({ timeout: 15000 })
}
try {
  await check(
    'audio requests playback mode and recovers interrupted or closed contexts',
    async () => {
      const { context, page, errors } = await fresh()
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'audioSession', {
          value: { type: 'auto' },
          configurable: true,
        })
        window.__sessionAtCreation = []
        window.AudioContext = new Proxy(window.AudioContext, {
          construct(target, args) {
            window.__sessionAtCreation.push(navigator.audioSession.type)
            return Reflect.construct(target, args)
          },
        })
      })
      await go(page, '/metronome')
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await page.waitForFunction(() => window.__ctx?.state === 'running')
      assert.deepEqual(await page.evaluate(() => window.__sessionAtCreation), [
        'playback',
      ])
      await page.getByRole('button', { name: 'Stop', exact: true }).click()
      await page.evaluate(async () => {
        const ctx = window.__ctx
        await ctx.suspend()
        const state = Object.getOwnPropertyDescriptor(
          BaseAudioContext.prototype,
          'state',
        ).get
        Object.defineProperty(ctx, 'state', {
          get() {
            const value = state.call(this)
            return value === 'suspended' ? 'interrupted' : value
          },
        })
        const resume = ctx.resume.bind(ctx)
        window.__resumeStates = []
        ctx.resume = () => {
          window.__resumeStates.push(ctx.state)
          return resume()
        }
      })
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await page.waitForFunction(() => window.__ctx.state === 'running')
      assert.deepEqual(await page.evaluate(() => window.__resumeStates), [
        'interrupted',
      ])
      await page.getByRole('button', { name: 'Stop', exact: true }).click()
      await page.evaluate(() => window.__ctx.close())
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await page.waitForFunction(
        () =>
          window.__sessionAtCreation.length === 2 &&
          window.__ctx.state === 'running',
      )
      await page.getByRole('button', { name: 'Stop', exact: true }).click()
      await page.getByRole('link', { name: 'Settings', exact: true }).click()
      await page
        .getByRole('button', { name: 'Play a test sound', exact: true })
        .click()
      await page
        .getByText('Did you hear the click?', { exact: false })
        .waitFor()
      await page.getByText('No sound?', { exact: true }).click()
      await page.getByText(/On iPhone, try turning off Silent Mode/).waitFor()
      assert.deepEqual(errors, [])
      await context.close()
    },
  )
  await check(
    'first-run action, mobile lesson pad and metronome Start fit small screens',
    async () => {
      const { context, page } = await fresh({ width: 320, height: 568 })
      await go(page, '/')
      assert.equal(
        await page.getByRole('link', { name: /Learn your first beat/ }).count(),
        1,
      )
      await page.getByRole('link', { name: /Learn your first beat/ }).click()
      const b = await page
        .getByRole('button', { name: 'Hear the example', exact: true })
        .boundingBox()
      assert.ok(b.y >= 0 && b.y + b.height <= 568, JSON.stringify(b))
      await go(page, '/metronome')
      const start = await page
        .getByRole('button', { name: 'Start', exact: true })
        .boundingBox()
      assert.ok(
        start.y >= 0 && start.y + start.height < 496,
        JSON.stringify(start),
      )
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await page.getByRole('button', { name: 'Stop', exact: true }).click()
      await context.close()
    },
  )
  await check(
    'native link activation and tempo editing preserve keyboard behavior',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/play/keep-1a')
      await page.getByRole('link', { name: '← Learn', exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(base + '/')
      await go(page, '/metronome')
      await page.getByRole('slider', { name: 'Tempo', exact: true }).focus()
      await page.keyboard.press('ArrowUp')
      assert.equal(
        await page
          .getByRole('slider', { name: 'Tempo', exact: true })
          .inputValue(),
        '101',
      )
      await page.getByRole('button', { name: /BPM/ }).click()
      await page
        .getByRole('textbox', { name: 'BPM', exact: true })
        .press('Space')
      assert.equal(
        await page.getByRole('button', { name: 'Stop', exact: true }).count(),
        0,
      )
      await context.close()
    },
  )
  await check(
    'guided example can replay, practice saves no stars, native/pointer taps count once',
    async () => {
      const { context, page } = await fresh({ width: 320, height: 568 })
      await go(page, '/play/keep-1a')
      await page
        .getByRole('button', { name: 'Hear the example', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Listen again', exact: true })
        .waitFor({ timeout: 12000 })
      await page
        .getByRole('button', { name: 'Listen again', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Practise together', exact: true })
        .waitFor({ timeout: 12000 })
      await page
        .getByRole('button', { name: 'Practise together', exact: true })
        .click()
      const countPadLocator = page.getByRole('button', {
        name: 'Wait for your turn',
        exact: true,
      })
      await countPadLocator.waitFor({ timeout: 12000 })
      const countPad = await countPadLocator.boundingBox()
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .waitFor({ timeout: 12000 })
      const startPad = page.getByRole('button', {
        name: 'Tap to start',
        exact: true,
      })
      const bounds = await startPad.boundingBox()
      assert.ok(
        Math.abs(bounds.y - countPad.y) < 4,
        `pad moves: ${countPad.y} to ${bounds.y}`,
      )
      assert.ok(
        bounds.y >= 0 && bounds.y + bounds.height <= 568,
        JSON.stringify(bounds),
      )
      await startPad.click()
      const pad = page.getByRole('button', { name: 'Tap', exact: true })
      assert.ok(Math.abs((await pad.boundingBox()).y - bounds.y) < 4)
      await page.waitForTimeout(1154)
      await pad.evaluate((b) => b.click())
      await page.waitForTimeout(1154)
      await pad.focus()
      await page.keyboard.press('Space')
      await page
        .getByRole('heading', { name: 'Practice round finished', exact: true })
        .waitFor({ timeout: 12000 })
      await page.getByText('Practice feedback', { exact: true }).click()
      assert.equal(
        await page.getByText('3 taps recorded', { exact: true }).count(),
        1,
        await page.locator('body').innerText(),
      )
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem('mymetronome-progress') ||
                '{"state":{"levels":{}}}',
            ).state.levels['keep-1a'],
        ),
        undefined,
      )
      await context.close()
    },
  )
  await check(
    'accurate independent rounds pass in all four game types',
    async () => {
      await Promise.all(
        ['keep-1a', 'echo-1b', 'memory-3a', 'silent-1a'].map(async (id) => {
          const { context, page, errors } = await fresh()
          await go(page, `/play/${id}`)
          await quick(page)
          await tapRound(page, id)
          assert.equal(
            await page.getByLabel('3 of 3 stars', { exact: true }).count(),
            1,
            id,
          )
          const result = await page.evaluate(
            (id) =>
              JSON.parse(localStorage.getItem('mymetronome-progress')).state
                .levels[id],
            id,
          )
          assert.equal(result.verifiedStars, 3, id)
          assert.deepEqual(errors, [])
          await context.close()
        }),
      )
    },
  )
  await check(
    'extra tapping through rests cannot earn a star; results contain no stale Miss',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/play/echo-1b')
      await quick(page)
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .click({ timeout: 20000 })
      await page.evaluate(() => {
        window.__spam = setInterval(() => {
          const b = [...document.querySelectorAll('button')].find(
            (b) => b.textContent === 'Tap',
          )
          b?.click()
        }, 20)
      })
      await page
        .getByRole('region', { name: 'Round result' })
        .waitFor({ timeout: 12000 })
      await page.evaluate(() => clearInterval(window.__spam))
      assert.equal(
        await page.getByLabel('0 of 3 stars', { exact: true }).count(),
        1,
      )
      assert.equal(await page.getByText('Miss', { exact: true }).count(), 0)
      assert.equal(
        await page
          .getByRole('link', { name: 'Next lesson', exact: true })
          .count(),
        0,
      )
      await context.close()
    },
  )
  await check(
    'waiting repeats the example without scores; a late first tap starts a full round',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/play/keep-1a')
      await quick(page)
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .waitFor({ timeout: 15000 })
      const sources = await page.evaluate(() => window.__audio.length)
      await page.waitForTimeout(10500)
      assert.equal(await page.locator('[data-phase="waiting"]').count(), 1)
      assert.equal(
        await page.getByRole('region', { name: 'Round result' }).count(),
        0,
      )
      assert.ok(
        (await page.evaluate(() => window.__audio.length)) > sources + 4,
      )
      assert.equal(
        await page
          .getByRole('link', { name: 'Next lesson', exact: true })
          .count(),
        0,
      )
      const recorded = await page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem('mymetronome-progress') ||
              '{"state":{"levels":{}}}',
          ).state.levels,
      )
      assert.deepEqual(recorded, {})
      await tapRound(page, 'keep-1a')
      await page.getByText('You matched 4 of 4 taps', { exact: true }).waitFor()
      assert.equal(
        await page.getByLabel('3 of 3 stars', { exact: true }).count(),
        1,
      )
      await context.close()
    },
  )
  await check(
    'keyboard first tap cancels every preview sound and counts exactly once in Silent Recall',
    async () => {
      const { context, page, errors } = await fresh()
      await go(page, '/play/memory-3b')
      await quick(page)
      const firstTap = page.getByRole('button', {
        name: 'Tap to start',
        exact: true,
      })
      await firstTap.waitFor({ timeout: 15000 })
      const initialSources = await page.evaluate(() => window.__audio.length)
      await page.waitForTimeout(6500)
      assert.ok(
        (await page.evaluate(() => window.__audio.length)) > initialSources,
      )
      assert.equal(await page.locator('[data-phase="waiting"]').count(), 1)
      assert.ok((await page.locator('[data-step]').count()) > 0)
      await firstTap.focus()
      await page.keyboard.press('Space')
      await page.getByRole('button', { name: 'Tap', exact: true }).waitFor()
      assert.equal(await page.locator('[data-step]').count(), 0)
      assert.equal(
        await page.evaluate(
          () =>
            window.__audio.filter(
              (source) =>
                source.start > window.__ctx.currentTime &&
                source.stops.every((stop) => stop > source.start),
            ).length,
        ),
        0,
      )
      const sourceCount = await page.evaluate(() => window.__audio.length)
      await page
        .getByRole('region', { name: 'Round result' })
        .waitFor({ timeout: 6000 })
      await page.getByText('You matched 1 of 2 taps', { exact: true }).waitFor()
      assert.equal(
        await page.evaluate(() => window.__audio.length),
        sourceCount,
      )
      await page.getByText('See timing details', { exact: true }).click()
      assert.equal(
        await page
          .getByText('Extra taps', { exact: true })
          .locator('..')
          .locator('strong')
          .innerText(),
        '0',
      )
      await page.getByRole('button', { name: 'Try again', exact: true }).click()
      await firstTap.waitFor({ timeout: 15000 })
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await page
        .getByRole('button', { name: 'Restart round', exact: true })
        .waitFor()
      await page
        .getByRole('button', { name: 'Restart round', exact: true })
        .click()
      await firstTap.waitFor({ timeout: 15000 })
      assert.ok((await page.locator('[data-step]').count()) > 0)
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('mymetronome-progress')).state
              .levels['memory-3b'].plays,
        ),
        1,
      )
      await page.getByRole('link', { name: '← Learn', exact: true }).click()
      await page.getByRole('link', { name: /Your next lesson/ }).waitFor()
      assert.equal(
        await page.evaluate(
          () =>
            window.__audio.filter(
              (source) =>
                source.start > window.__ctx.currentTime &&
                source.stops.every((stop) => stop > source.start),
            ).length,
        ),
        0,
      )
      assert.deepEqual(errors, [])
      await context.close()
    },
  )
  await check(
    'memory hides both note and rest identities, and pause offers an unscored restart',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/play/memory-3a')
      await quick(page)
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .waitFor({ timeout: 20000 })
      assert.ok((await page.locator('[data-step]').count()) > 0)
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .click()
      assert.equal(await page.locator('[data-step]').count(), 0)
      assert.equal(
        await page.getByRole('img', { name: /Pattern hidden/ }).count(),
        1,
      )
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await page
        .getByRole('button', { name: 'Restart round', exact: true })
        .waitFor()
      assert.equal(
        await page.getByRole('region', { name: 'Round result' }).count(),
        0,
      )
      await context.close()
    },
  )
  await check(
    'leaving a demonstration cancels all future audio sources',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/play/echo-4b')
      await page
        .getByRole('button', { name: 'Hear the example', exact: true })
        .click()
      await page.waitForFunction(() => window.__audio.length > 3)
      await page.getByRole('link', { name: '← Learn', exact: true }).click()
      await page.getByRole('link', { name: /Learn your first beat/ }).waitFor()
      await page.waitForFunction(() =>
        window.__audio.every(
          (s) =>
            s.start <= window.__ctx.currentTime ||
            s.stops.some((stop) => stop <= s.start),
        ),
      )
      const uncancelled = await page.evaluate(
        () =>
          window.__audio.filter(
            (s) =>
              s.start > window.__ctx.currentTime &&
              s.stops.every((stop) => stop > s.start),
          ).length,
      )
      assert.equal(uncancelled, 0)
      await context.close()
    },
  )
  await check(
    'all 40 lessons render, and stored historical results remain available',
    async () => {
      const stored = {
        state: {
          levels: {
            'keep-1a': {
              bestScore: 420,
              bestAccuracy: 100,
              stars: 3,
              plays: 1,
              lastPlayedAt: '2026-01-01T00:00:00.000Z',
            },
          },
          streakDays: 5,
          lastPracticeDate: '2026-01-01',
          recentAccuracies: [100],
        },
        version: 0,
      }
      const { context, page, errors } = await fresh(undefined, {
        'mymetronome-progress': stored,
      })
      for (const level of allLevels) {
        await go(page, `/play/${level.id}`)
        await page
          .getByRole('heading', { name: level.title, exact: true })
          .waitFor()
      }
      await go(page, '/progress')
      await page
        .getByText('Earlier saved results (1)', { exact: true })
        .waitFor()
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('mymetronome-progress')).state
              .levels['keep-1a'].bestScore,
        ),
        420,
      )
      assert.deepEqual(errors, [])
      await context.close()
    },
  )
  await check(
    'three-lesson session resumes between rounds and reaches a finish screen',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/practice')
      await page
        .getByRole('button', { name: 'Begin first lesson', exact: true })
        .click()
      for (const id of ['keep-1a', 'keep-1b', 'echo-1a']) {
        await page
          .getByRole('heading', {
            name: allLevels.find((l) => l.id === id).title,
            exact: true,
          })
          .waitFor()
        await page.evaluate(() => {
          window.__audio = []
        })
        await quick(page)
        await tapRound(page, id)
        if (id === 'echo-1a')
          await page
            .getByRole('link', { name: 'Finish session', exact: true })
            .click()
        else {
          await page
            .getByRole('link', { name: 'Next in session', exact: true })
            .click()
          await page
            .getByRole('link', { name: '← Practice session', exact: true })
            .click()
          await page.getByRole('link', { name: /Continue session/ }).click()
        }
      }
      await page
        .getByRole('heading', {
          name: 'You made time for rhythm.',
          exact: true,
        })
        .waitFor()
      await page.reload()
      await page
        .getByRole('heading', {
          name: 'You made time for rhythm.',
          exact: true,
        })
        .waitFor()
      await context.close()
    },
  )
  await check(
    'motion preference persists, calibration estimates delay, and interrupted rounds pause',
    async () => {
      const { context, page } = await fresh()
      await go(page, '/settings')
      await page
        .getByRole('checkbox', { name: 'Prefer reduced motion', exact: true })
        .check()
      await page.reload()
      assert.equal(
        await page.locator('html').getAttribute('data-reduced-motion'),
        'true',
      )
      await page
        .getByRole('button', { name: 'Start guided calibration', exact: true })
        .click()
      await page.waitForFunction(() => window.__audio.length >= 12)
      assert.equal(
        await page
          .getByRole('button', { name: 'Play a test sound', exact: true })
          .isDisabled(),
        true,
      )
      await page.evaluate(async () => {
        const origin = window.__audio[0].start
        for (let i = 4; i < 12; i++) {
          const target = origin + i * 0.75 + 0.1
          await new Promise((resolve) => {
            const tick = () => {
              const stamp = window.__ctx.getOutputTimestamp()
              const now =
                stamp.contextTime +
                (performance.now() - stamp.performanceTime) / 1000
              if (now >= target) {
                ;[...document.querySelectorAll('button')]
                  .find((b) => b.textContent === 'Tap')
                  ?.click()
                resolve()
              } else requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          })
        }
      })
      await page
        .getByRole('button', { name: 'Use this offset', exact: true })
        .waitFor({ timeout: 5000 })
      await page
        .getByRole('button', { name: 'Use this offset', exact: true })
        .click()
      const offset = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('mymetronome-settings')).state
            .latencyOffsetMs,
      )
      assert.ok(offset >= 80 && offset <= 140, `calibration: ${offset}`)
      await go(page, '/play/keep-1a')
      await quick(page)
      await page
        .getByRole('button', { name: 'Tap to start', exact: true })
        .waitFor({ timeout: 10000 })
      await page.evaluate(() => window.__ctx.suspend())
      await page
        .getByRole('button', { name: 'Restart round', exact: true })
        .waitFor()
      assert.equal(
        await page.getByRole('region', { name: 'Round result' }).count(),
        0,
      )
      await context.close()
    },
  )
  await check(
    'offline reload and local progress survive a completed round',
    async () => {
      const { context, page } = await fresh()
      await page.goto(base + '/')
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready
        if (!navigator.serviceWorker.controller)
          await new Promise((resolve) =>
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              resolve,
              { once: true },
            ),
          )
      })
      await context.setOffline(true)
      await page.goto(base + '/play/keep-1a')
      await quick(page)
      await tapRound(page, 'keep-1a')
      await page.goto(base + '/progress')
      await page
        .getByRole('heading', { name: 'Progress', exact: true })
        .waitFor()
      await page.reload()
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('mymetronome-progress')).state
              .levels['keep-1a'].verifiedStars,
        ),
        3,
      )
      await context.close()
    },
  )
  assert.ok(checks > 0, 'At least one browser check must run')
  console.log(`\n${checks} product checks passed.`)
} finally {
  await browser.close()
}
