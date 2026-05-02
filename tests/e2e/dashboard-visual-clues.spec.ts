import { test, expect } from '@playwright/test'

test.describe('Dashboard visual clues', () => {
  test('shows sync freshness cue and no trend badges on fixtures page', async ({ page }) => {
    await page.goto('/e2e-fixtures/dashboard-visual-clues')

    await expect(page.getByTestId('dashboard-sync-freshness')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('No period comparison')).toHaveCount(0, { timeout: 10000 })
  })
})
