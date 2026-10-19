import { chromium } from 'playwright'

const url = process.env.APP_URL || 'http://127.0.0.1:4173/play/keep-3a'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addInitScript(() => {
  // Avoid stale service-worker caches during smoke tests
  navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()))
})
const page = await context.newPage()

const logs = []
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))

await page.goto(url + `?t=${Date.now()}`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tap to start')

// Instrument engine beat spacing via page
await page.exposeFunction('reportBeat', (payload) => {
  logs.push(`BEAT ${JSON.stringify(payload)}`)
})

await page.evaluate(() => {
  // Hook performance now around taps
  window.__times = { start: 0, done: 0, beats: [] }
})

const t0 = Date.now()
await page.click('text=Tap to start')

// Wait for countdown + game + results (max 30s)
await page.waitForSelector('text=Level complete', { timeout: 30000 })
const elapsed = Date.now() - t0

const counter = await page.locator('text=/\\d+\\/\\d+/').first().textContent().catch(() => null)
const accuracy = await page.locator('text=Accuracy').locator('..').textContent().catch(() => null)

console.log(JSON.stringify({ elapsedMs: elapsed, counter, accuracy }, null, 2))
console.log('--- logs ---')
console.log(logs.slice(-40).join('\n'))

await browser.close()
process.exit(elapsed < 8000 ? 2 : 0)
