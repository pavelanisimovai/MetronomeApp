import { chromium } from 'playwright'

const url = `http://127.0.0.1:4173/play/echo-1a?t=${Date.now()}`
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addInitScript(() => {
  navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()))
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tap to start')
const t0 = Date.now()
await page.click('text=Tap to start')
await page.waitForSelector('text=Level complete', { timeout: 30000 })
const elapsed = Date.now() - t0
console.log(JSON.stringify({ elapsedMs: elapsed }))
await browser.close()
process.exit(elapsed < 3000 ? 2 : 0)
