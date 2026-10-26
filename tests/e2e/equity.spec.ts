import { expect, test } from '@playwright/test'
import { exactHeadsUp } from '../../src/engine/equity/exactHU.ts'
import { parseCards, parseRangeStrict } from '../../src/engine/index.ts'

test('heads-up flop equity matches the engine and follows board changes', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('range-text').fill('QQ+,AK')
  await page.getByTestId('range-text').blur()
  await page.getByTestId('player-1').click()
  await page.getByTestId('range-text').fill('22+,A2s+,KTs+,QTs+,JTs,ATo+,KJo+')
  await page.getByTestId('range-text').blur()
  await page.getByTestId('player-0').click()
  await page.getByTestId('tab-equity').click()

  // Start on one flop, then switch: the stale job must not win.
  await page.getByTestId('board-text').fill('2c3d4h')
  await page.getByTestId('board-text').press('Enter')
  await page.getByTestId('board-text').fill('Ks7d2c')
  await page.getByTestId('board-text').press('Enter')

  const expected = exactHeadsUp(
    parseRangeStrict('QQ+,AK'),
    parseRangeStrict('22+,A2s+,KTs+,QTs+,JTs,ATo+,KJo+'),
    parseCards('Ks7d2c'),
  ).players[0]!
  await expect(page.getByTestId('equity-method')).toHaveText(/Exact/)
  await expect(page.getByTestId('equity-0')).toHaveText(`${(expected * 100).toFixed(2)}%`)
  await expect(page.getByTestId('equity-matrix')).toBeVisible()
})

test('bunching switches equity to Monte Carlo with folded hands dealt out', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('board-text').fill('Ks7d2c')
  await page.getByTestId('board-text').press('Enter')
  await page.getByTestId('tab-equity').click()
  await expect(page.getByTestId('equity-method')).toHaveText(/Exact/)
  await page.getByLabel('Folded players', { exact: true }).selectOption('3')
  await expect(page.getByTestId('equity-method')).toHaveText(/Monte Carlo/, { timeout: 15000 })
})
