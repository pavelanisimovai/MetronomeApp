import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4173/metronome?nosw=1&x=${Date.now()}`, {
  waitUntil: 'networkidle',
})
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Start' }).click()
await page.waitForTimeout(400)
const afterStart = await page.getByRole('button', { name: /Start|Stop/ }).textContent()
await page.getByRole('button', { name: 'Stop' }).click()
await page.waitForTimeout(200)
const afterStop = await page.getByRole('button', { name: /Start|Stop/ }).textContent()
console.log(JSON.stringify({ afterStart, afterStop }))
await browser.close()
if (afterStart?.trim() !== 'Stop' || afterStop?.trim() !== 'Start') process.exit(2)
