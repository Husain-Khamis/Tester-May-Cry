const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const fixture = (name) => fs.readFileSync(path.join(__dirname, '../server/test/fixtures', name), 'utf8')
const getValue = (page) => page.evaluate(() => window.monaco.editor.getModels()[0].getValue())
const setValue = (page, code) =>
  page.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), code)

// exercises sit under collapsible checkpoint > mission groups; open them in order until `target` shows
async function expandUntil(page, target) {
  const closed = page.getByRole('button', { name: /▼$/ })
  await expect(closed.first()).toBeVisible({ timeout: 60_000 })
  while (!(await target.isVisible()) && (await closed.count())) await closed.first().click()
}

async function openGcd(page) {
  await page.goto('/')
  for (const name of ['Go', 'JavaScript', 'Rust']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
  }

  await page.getByRole('button', { name: /^Go/ }).click()
  await expect(page).toHaveURL(/\/questions\?lang=go/)

  await expandUntil(page, page.getByRole('button', { name: 'gcd', exact: true }).first())
  await page.getByRole('button', { name: 'gcd', exact: true }).first().click()

  await page.waitForSelector('.monaco-editor')
}

test('go gcd: pass and fail', async ({ page }) => {
  await openGcd(page)
  await expect.poll(() => getValue(page)).toBe('// gcd.go\n')

  await setValue(page, fixture('gcd.go'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Clear', { exact: true })).toBeVisible({ timeout: 150_000 })
  await expect(page.getByText('Stylish!!!', { exact: true })).toBeVisible()

  await setValue(page, fixture('gcd_bad.go'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Failed', { exact: true })).toBeVisible({ timeout: 150_000 })
})


test('output panel is resizable', async ({ page }) => {
  await openGcd(page)
  const output = page.getByTestId('output-panel')
  const before = (await output.boundingBox()).height

  const handle = (await page.getByTestId('output-handle').boundingBox())
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 150, { steps: 10 })
  await page.mouse.up()

  expect((await output.boundingBox()).height).toBeGreaterThan(before + 100)
})

async function openExercise(page, lang, name) {
  await page.getByRole('button', { name: lang }).click()
  const ex = page.getByRole('button', { name: new RegExp(`^${name}\\s*(✓|SSS|SS|S|A|B|C|D)?$`) })
  await expandUntil(page, ex.first())
  await ex.first().click()
  await page.waitForSelector('.monaco-editor')
}

test('js factorial: run executes the usage program', async ({ page }) => {
  await page.goto('/')
  await openExercise(page, /^JavaScript/, 'js-factorial')
  await expect(page.getByRole('button', { name: 'main (usage)' })).toBeVisible({ timeout: 30_000 })
  await setValue(page, fixture('factorial.js'))
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('output-panel').locator('pre')).toHaveText('120\n1')
})

test('save slot: autosave, passed mark, export', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  page.once('dialog', (d) => d.accept('E2E'))
  await page.getByRole('button', { name: 'New game' }).first().click()
  await expect(page.getByText('E2E', { exact: true })).toBeVisible()

  await openExercise(page, /^Go/, 'gcd')
  await setValue(page, fixture('gcd.go'))
  await page.waitForTimeout(1000) // autosave debounce
  await page.reload()
  await openExercise(page, /^Go/, 'gcd')
  await expect.poll(() => getValue(page)).toBe(fixture('gcd.go'))

  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Clear', { exact: true })).toBeVisible({ timeout: 150_000 })
  await expect(page.getByRole('button', { name: /^gcd\s*SSS$/ })).toBeVisible()

  await page.getByRole('link', { name: 'Tester May Cry' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('solid-tester-E2E.json')
})

test('js factorial: fail then pass ranks SS', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await openExercise(page, /^JavaScript/, 'js-factorial')
  await setValue(page, fixture('factorial_bad.js'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Failed', { exact: true })).toBeVisible({ timeout: 150_000 })
  await setValue(page, fixture('factorial.js'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Showtime!!', { exact: true })).toBeVisible({ timeout: 150_000 })
  await expect(page.getByRole('button', { name: /^js-factorial\s*SS$/ })).toBeVisible()
})

test('go onlya (program exercise): run works without a usage tab', async ({ page }) => {
  await page.goto('/')
  await openExercise(page, /^Go/, 'onlya')
  await setValue(page, fixture('onlya.go'))
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('output-panel').locator('pre')).toHaveText('a', { timeout: 150_000 })
})

test('js run captures async logs from timers', async ({ page }) => {
  await page.goto('/')
  await openExercise(page, /^JavaScript/, 'js-factorial')
  await setValue(page, fixture('factorial.js') + "\nsetTimeout(() => console.log('later'), 100); console.log('now')")
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const out = page.getByTestId('output-panel').locator('pre')
  await expect(out).toContainText('now')
  await expect(out).toContainText('later')
})

async function expectStoppableDialog(page, run) {
  const dialog = page.getByRole('dialog', { name: /taking longer than usual/ })
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('longrun-countdown')).toHaveText(/^0:\d\d$/)
  await expect(page.getByRole('button', { name: 'Stop' })).toBeFocused()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('output-panel')).toContainText('stopped by user')
  await expect(page.getByRole('button', { name: run, exact: true })).toBeEnabled()
}

test('js infinite loop: dialog appears and Stop kills the run', async ({ page }) => {
  await page.goto('/')
  await openExercise(page, /^JavaScript/, 'js-factorial')
  await setValue(page, 'while (true) {}')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expectStoppableDialog(page, 'Run')
})

test('go infinite loop: Stop removes the grader container', async ({ page }) => {
  const graders = () => execFileSync('docker', ['ps', '-q', '--filter', 'label=solid-tester-grader']).toString().split('\n').filter(Boolean)
  const before = new Set(graders())
  await openGcd(page)
  await setValue(page, fixture('gcd_loop.go'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expectStoppableDialog(page, 'Test')
  // only containers started by this test; others may run concurrently
  await expect.poll(() => graders().filter(id => !before.has(id)), { timeout: 5000 }).toEqual([])
})

test('go allowed functions are shown in the question header', async ({ page }) => {
  await page.goto('/')
  const builtins = page.getByText('builtins (len, append, …)')
  await openExercise(page, /^Go/, 'onlya')
  await expect(page.getByText('Allowed functions')).toBeVisible()
  await expect(page.getByText('github.com/01-edu/z01.PrintRune')).toBeVisible()
  await expect(builtins).toBeVisible()
  await page.goto('/')
  await openExercise(page, /^Go/, 'checknumber')
  await expect(page.getByText('Any (no restrictions)')).toBeVisible()
  await page.goto('/')
  await openExercise(page, /^Go/, 'gcd')
  await expect(builtins).toBeVisible()
  await expect(page.getByText('github.com/')).toHaveCount(0)
})

test('js sidebar: checkpoint 3 mission 5 lists the deep-* exercises', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^JavaScript/ }).click()
  await page.getByRole('button', { name: /^Checkpoint 3/ }).click()
  await page.getByRole('button', { name: /^Mission 5/ }).click()
  await expect(page.getByRole('button', { name: 'js-deep-clone', exact: true })).toBeVisible({ timeout: 60_000 })
})

test('progress is shared across checkpoints by exercise name', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await openExercise(page, /^JavaScript/, 'js-factorial') // first copy lives in Checkpoint 1
  await setValue(page, fixture('factorial.js'))
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Clear', { exact: true })).toBeVisible({ timeout: 150_000 })
  await page.getByRole('button', { name: /^Checkpoint 1/ }).click() // collapse it
  await page.getByRole('button', { name: /^Checkpoint 2/ }).click()
  await page.getByRole('button', { name: /^Mission 1/ }).click()
  await expect(page.getByRole('button', { name: /^js-factorial\s*(SSS|SS|S|A|B|C|D|✓)$/ })).toHaveCount(1)
})

test('bloody palace asks for a checkpoint and starts that exam', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^JavaScript/ }).click()
  await expect(page.getByRole('button', { name: /^Checkpoint 1/ })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Bloody Palace' }).click()
  await expect(page.getByRole('dialog', { name: /choose a checkpoint/ })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Checkpoint final' }).click()
  await expect(page.getByText('Bloody Palace · Checkpoint final')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Mission \d+/ })).toHaveCount(7)
})

async function startPalace(page, lang, checkpoint) {
  await page.goto('/')
  await page.getByRole('button', { name: lang }).click()
  await expect(page.getByRole('button', { name: /^Checkpoint 1/ })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Bloody Palace' }).click()
  await page.getByRole('dialog').getByRole('button', { name: checkpoint }).click()
  await expect(page.getByText(`Bloody Palace · ${checkpoint}`)).toBeVisible()
  await page.getByRole('button', { name: /^Mission 1/ }).click()
  await page.waitForSelector('.monaco-editor')
  return (await page.locator('h1').innerText()).trim()
}

test('bloody palace time-up replaces the exam with the ended screen', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: /^JavaScript/ }).click()
  await expect(page.getByRole('button', { name: /^Checkpoint 1/ })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Bloody Palace' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Checkpoint 1' }).click()
  await expect(page.getByText('Bloody Palace · Checkpoint 1')).toBeVisible()
  await page.waitForSelector('.monaco-editor')
  await expect(page.getByText(/⏱ 0[23]:\d\d:\d\d/)).toBeVisible()

  await page.clock.runFor('03:00:05')
  await expect(page.getByText('Time is Up', { exact: true })).toBeVisible()
  await expect(page.getByText('Your Bloody Palace run has ended')).toBeVisible()
  await expect(page.locator('.monaco-editor')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Test', exact: true })).toHaveCount(0)
})

test('bloody palace go: mission 1 program exercise passes and runs', async ({ page }) => {
  const name = await startPalace(page, /^Go/, 'Checkpoint 1')
  const ch = name.match(/^only(.)$/)?.[1]
  test.skip(!ch, `mission 1 is ${name}, not an only* exercise`)
  await setValue(page, `package main\n\nimport "github.com/01-edu/z01"\n\nfunc main() {\n\tz01.PrintRune('${ch}')\n}\n`)
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('output-panel').locator('pre')).toHaveText(ch, { timeout: 150_000 })
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect(page.getByText('Mission Clear', { exact: true })).toBeVisible({ timeout: 150_000 })
})

test('bloody palace rust: mission 1 grades and runs', async ({ page }) => {
  const name = await startPalace(page, /^Rust/, 'Checkpoint 1')
  await expect(page.getByRole('button', { name: /usage/ })).toBeVisible({ timeout: 30_000 })
  if (name === 'min_and_max') {
    await setValue(page, fixture('min_and_max.rs'))
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.getByText('Mission Clear', { exact: true })).toBeVisible({ timeout: 300_000 })
  } else {
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.getByText('Mission Failed', { exact: true })).toBeVisible({ timeout: 300_000 })
  }
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('output-panel').locator('pre')).toBeVisible({ timeout: 300_000 })
})
