import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'node:fs'
const outDir = process.env.SCREENSHOT_DIR || '/tmp/metronome-demo'
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({
  headless: process.env.HEADED !== '1',
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const base = process.env.APP_URL || 'http://127.0.0.1:4173'
  for (const [name, path] of [
    ['learn', '/'],
    ['metronome', '/metronome'],
    ['first-lesson', '/play/keep-1a'],
  ]) {
    await page.goto(`${base}${path}?nosw=1`)
    await page.locator('h1').waitFor()
    await page.screenshot({ path: `${outDir}/${name}.png` })
  }
  await page
    .getByRole('button', { name: 'Hear the example', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Practise together', exact: true })
    .waitFor({ timeout: 12000 })
  await page
    .getByRole('button', { name: 'Practise together', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Tap to start', exact: true })
    .waitFor({ timeout: 12000 })
  await page.screenshot({ path: `${outDir}/waiting-for-first-tap.png` })
  await page.getByRole('button', { name: 'Tap to start', exact: true }).click()
  await page.screenshot({ path: `${outDir}/guided-practice.png` })
  console.log(`Screenshots saved in ${outDir}`)
} finally {
  await browser.close()
}
