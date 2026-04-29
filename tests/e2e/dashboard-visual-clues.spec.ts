import { test, expect } from '@playwright/test'

test.describe('Dashboard visual clues', () => {
  test('shows temporal and trend cues on dashboard fixtures page', async ({ page }) => {
    await page.goto('/e2e-fixtures/dashboard-visual-clues')

    await expect(page.getByTestId('dashboard-trend-window')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dashboard-sync-freshness')).toBeVisible({ timeout: 10000 })

    await expect(page.getByTestId('dashboard-trend-total-activities')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dashboard-trend-total-distance')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dashboard-trend-total-elevation')).toBeVisible({ timeout: 10000 })
  })
})
