import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const base = process.env.APP_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
})
let scans = 0
const failures = []
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  async function scan(label) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    scans++
    failures.push(
      ...result.violations.map((v) => ({
        page: label,
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    )
    console.log(
      `${label}: ${result.violations.length} violations; ${result.incomplete.length} rules need manual review`,
    )
  }
  for (const path of [
    '/',
    '/metronome',
    '/settings',
    '/progress',
    '/practice',
    '/play/keep-1a',
    '/play/echo-1b',
  ]) {
    await page.goto(`${base}${path}?nosw=1`)
    await page.locator('h1').waitFor()
    await scan(path)
    if (path === '/metronome') {
      await page.getByText('Sound & rhythm options', { exact: true }).click()
      await scan('metronome expanded options')
    }
  }
  await page.getByRole('button', { name: 'Quick start', exact: true }).click()
  await page
    .getByRole('button', { name: 'Start with a count-in', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Tap to start', exact: true })
    .waitFor({ timeout: 20000 })
  await scan('waiting for first tap')
  await page.getByRole('button', { name: 'Tap to start', exact: true }).click()
  await scan('echo during response')
  await page
    .getByRole('region', { name: 'Round result' })
    .waitFor({ timeout: 15000 })
  await scan('partially completed result')
  assert.deepEqual(failures, [])
  console.log(
    `${scans} accessibility scans passed. Manual assistive-technology testing is still required.`,
  )
} finally {
  await browser.close()
}
