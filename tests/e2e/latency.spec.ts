import { expect, test } from '@playwright/test'

// Timing is sensitive to CPU contention from other workers running exact equity, so this
// file runs serially and retries before reporting a failure.
test.describe.configure({ mode: 'serial', retries: 2 })

test('stats refresh quickly after an edit', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('range-text').fill('random')
  await page.getByTestId('range-text').blur()
  await page.getByTestId('board-text').fill('Ks7d2c')
  await page.getByTestId('board-text').press('Enter')
  await expect(page.getByTestId('range-summary')).toContainText('1176 combos')
  const elapsed = await page.evaluate(async () => {
    const box = document.querySelector<HTMLInputElement>('[data-testid=board-text]')!
    const start = performance.now()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(box, 'Ah8d3c')
    box.dispatchEvent(new Event('input', { bubbles: true }))
    box.form!.requestSubmit()
    while (
      !document
        .querySelector('[data-testid=stats-table]')
        ?.closest('section')
        ?.textContent?.includes('A♥')
    ) {
      await new Promise((r) => requestAnimationFrame(r))
      if (performance.now() - start > 5000) break
    }
    return performance.now() - start
  })
  console.log(`stats visible ${elapsed.toFixed(0)} ms after the edit`)
  expect(elapsed).toBeLessThan(300)
})
