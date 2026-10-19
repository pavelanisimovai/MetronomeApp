/**
 * Headed demo for walkthrough evidence: Train → Metronome → Echo with timed taps.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const outDir = '/opt/cursor/artifacts/screenshots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=440,920'],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
await context.addInitScript(() => {
  navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()))
})
const page = await context.newPage()
const base = `http://127.0.0.1:4173`
const bust = () => `nosw=1&demo=${Date.now()}`

await page.goto(`${base}/?${bust()}`, { waitUntil: 'networkidle' })
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('text=MyMetronome')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${outDir}/demo_train_hub.png` })

await page.goto(`${base}/metronome?${bust()}`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Metronome')
await page.getByRole('button', { name: 'Start' }).click()
await page.waitForTimeout(2200)
await page.screenshot({ path: `${outDir}/demo_metronome.png` })
await page.getByRole('button', { name: 'Stop' }).click()
await page.waitForTimeout(400)

await page.goto(`${base}/play/echo-3a?${bust()}`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tap to start')
await page.screenshot({ path: `${outDir}/demo_echo_ready.png` })
await page.getByRole('button', { name: 'Tap to start' }).click()

await page.waitForSelector('text=Your turn', { timeout: 20000 })
await page.screenshot({ path: `${outDir}/demo_echo_respond.png` })

const pad = page.getByRole('button', { name: 'Tap' })
for (let i = 0; i < 4; i++) {
  await pad.dispatchEvent('pointerdown')
  await page.waitForTimeout(750)
}

await page.waitForSelector('text=Level complete', { timeout: 12000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${outDir}/demo_echo_results.png` })

console.log('demo screenshots written to', outDir)
await page.waitForTimeout(800)
await browser.close()
