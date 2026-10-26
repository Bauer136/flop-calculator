import { expect, test } from '@playwright/test'

test('a saved range survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('range-text').fill('JJ+,AQs+')
  await page.getByTestId('range-text').blur()
  await page.getByRole('button', { name: 'Library' }).click()
  await page.getByLabel('Range name').fill('My 3-bet')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.reload()
  await page.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('dialog')).toContainText('My 3-bet')
  await expect(page.getByRole('dialog')).toContainText('JJ+,AQs+')
})

test('a share link restores the setup in a fresh browser', async ({ page, browser }) => {
  await page.goto('/')
  await page.getByTestId('range-text').fill('TT+,AJs+')
  await page.getByTestId('range-text').blur()
  await page.getByTestId('board-text').fill('Jh8h3c')
  await page.getByTestId('board-text').press('Enter')
  await page.locator('[data-stat="made.overpair"] input').check()
  await page.getByTestId('filter-keep').click()
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page).toHaveURL(/#s=/)
  const url = page.url()

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto(url)
  await expect(other.getByTestId('range-text')).toHaveValue('TT+,AJs+')
  await expect(other.getByTestId('board-slots')).toContainText('J')
  await expect(other.getByTestId('filter-list')).toContainText('Keep Overpair')
  await fresh.close()
})
