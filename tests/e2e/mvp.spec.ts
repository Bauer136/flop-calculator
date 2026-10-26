import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Flop Calculator' })).toBeVisible()
})

async function setRange(page: import('@playwright/test').Page, text: string) {
  const box = page.getByTestId('range-text')
  await box.fill(text)
  await box.blur()
}

async function setBoard(page: import('@playwright/test').Page, text: string) {
  await page.getByTestId('board-text').fill(text)
  await page.getByTestId('board-text').press('Enter')
}

const statValue = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-stat="${id}"] td`).nth(1)

test('range text + board show correct combo counts', async ({ page }) => {
  await setRange(page, 'QQ+,AK')
  await setBoard(page, 'Ks7d2c')
  await expect(page.getByTestId('range-summary')).toContainText('27 combos')
  await expect(statValue(page, 'made.set')).toHaveText('3')
  await expect(statValue(page, 'made.overpair')).toHaveText('6')
  await expect(statValue(page, 'made.topPair')).toHaveText('12')
  await expect(statValue(page, 'made.ppBelowTopPair')).toHaveText('6')
})

test('painting the matrix updates the text box and stats without a button', async ({ page }) => {
  await setRange(page, '')
  await setBoard(page, 'Ks7d2c')
  const matrix = page.getByTestId('range-matrix')
  await matrix.locator('[data-cls="0"]').click() // AA
  await expect(page.getByTestId('range-text')).toHaveValue('AA')
  await expect(statValue(page, 'made.overpair')).toHaveText('6')
  // Drag across KK → QQ on the diagonal paints both.
  const kk = matrix.locator('[data-cls="14"]')
  const qq = matrix.locator('[data-cls="28"]')
  await kk.hover()
  await page.mouse.down()
  await qq.hover()
  await page.mouse.up()
  await expect(page.getByTestId('range-text')).toHaveValue('QQ+')
})

test('filtering on the flop carries into the turn, and undo restores', async ({ page }) => {
  await setRange(page, 'QQ+,AK')
  await setBoard(page, 'Ks7d2c')
  await page.locator('[data-stat="made.topPair"] input').check()
  await page.getByTestId('filter-keep').click()
  await expect(page.getByTestId('filter-list')).toContainText('Keep Top pair')
  await setBoard(page, 'Ks7d2c9h')
  await expect(page.getByTestId('street-turn')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('range-summary')).toContainText('12 combos')
  await expect(statValue(page, 'made.topPair')).toHaveText('12')

  await page.getByTestId('board-text').blur() // inside a text box, Ctrl+Z is the box's own undo
  await page.keyboard.press('Control+z') // undo the board change
  await page.keyboard.press('Control+z') // undo the filter
  await expect(page.getByTestId('range-summary')).toContainText('27 combos')
})
