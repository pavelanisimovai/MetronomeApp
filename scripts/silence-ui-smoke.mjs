import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const outDir = '/opt/cursor/artifacts/screenshots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(`http://127.0.0.1:4173/play/silent-4?nosw=1&t=${Date.now()}`, {
  waitUntil: 'networkidle',
})
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('text=Sound')
await page.screenshot({ path: `${outDir}/silence_ui_ready.png` })

await page.getByRole('button', { name: 'Tap to start' }).click()
// Wait until silence phase (page sets data-silence="true")
await page.waitForSelector('[data-silence="true"]', { timeout: 25000 })
await page.waitForTimeout(350)
await page.screenshot({ path: `${outDir}/silence_ui_mute_phase.png` })

const muted = await page.locator('[data-silence="true"]').count()
const silenceLabel = await page.getByText('Silence', { exact: true }).count()
const tapLabel = await page.getByRole('button', { name: 'Tap through silence' }).count()
const boxes = await page.locator('[class*="boxTrack"] > *').count()
console.log(JSON.stringify({ muted, silenceLabel, tapLabel, boxes }))
await browser.close()
if (muted < 1 || tapLabel < 1 || boxes < 2) process.exit(2)
