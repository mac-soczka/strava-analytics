import { test, expect } from '@playwright/test'

test.describe('Route map fixtures (polyline + Leaflet)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/tile.openstreetmap.org/**', (route) => route.abort())
  })

  test('renders SVG thumbnail and Leaflet container', async ({ page }) => {
    await page.goto('/e2e-fixtures/route-map')

    const thumb = page.getByTestId('activity-route-map-thumb')
    await expect(thumb).toBeVisible()
    const poly = thumb.locator('polyline')
    await expect(poly).toHaveAttribute('points', /.+/)

    const leafletWrap = page.getByTestId('route-map-leaflet')
    await expect(leafletWrap).toBeVisible()
    await expect(leafletWrap.locator('.leaflet-container')).toBeVisible()
  })

  test('null / empty polyline does not break the page', async ({ page }) => {
    await page.goto('/e2e-fixtures/route-map')
    await expect(page.getByTestId('fixture-section-null-polyline')).toBeVisible()
    await expect(page.getByTestId('no-route-label')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/E2E route map fixtures/)
  })
})
