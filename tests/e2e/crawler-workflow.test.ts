import { test, expect } from '@playwright/test'

test.describe.skip('Crawler E2E Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug')
  })

  test('should trigger crawler and show results', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="crawler-control"]')

    // Click the "Trigger Crawler" button
    await page.click('button:has-text("Trigger Crawler")')

    // Wait for the crawler to start
    await page.waitForSelector('text=Running...', { timeout: 10000 })

    // Wait for the crawler to complete (this might take a while)
    await page.waitForSelector('text=Completed', { timeout: 60000 })

    // Check that results are displayed
    await expect(page.locator('[data-testid="crawler-stats"]')).toBeVisible()
    await expect(page.locator('[data-testid="crawler-logs"]')).toBeVisible()

    // Verify that some activities were processed
    const statsText = await page.locator('[data-testid="crawler-stats"]').textContent()
    expect(statsText).toContain('Total Activities')
  })

  test('should display crawler logs', async ({ page }) => {
    // Wait for logs to load
    await page.waitForSelector('[data-testid="crawler-logs"]')

    // Check that logs are displayed
    const logs = await page.locator('[data-testid="crawler-logs"] .log-entry').count()
    expect(logs).toBeGreaterThan(0)

    // Check that log entries have the expected structure
    const firstLog = await page.locator('[data-testid="crawler-logs"] .log-entry').first()
    await expect(firstLog.locator('.log-status')).toBeVisible()
    await expect(firstLog.locator('.log-message')).toBeVisible()
    await expect(firstLog.locator('.log-timestamp')).toBeVisible()
  })

  test('should handle crawler errors gracefully', async ({ page }) => {
    // Mock the API to return an error
    await page.route('/api/strava/crawl', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Test error'
        })
      })
    })

    // Click the "Trigger Crawler" button
    await page.click('button:has-text("Trigger Crawler")')

    // Wait for error to be displayed
    await page.waitForSelector('text=Error', { timeout: 10000 })

    // Verify error message is shown
    await expect(page.locator('text=Test error')).toBeVisible()
  })

  test('should show rate limit status', async ({ page }) => {
    // Wait for rate limit status to load
    await page.waitForSelector('[data-testid="rate-limit-status"]')

    // Check that rate limit information is displayed
    await expect(page.locator('text=15min')).toBeVisible()
    await expect(page.locator('text=Day')).toBeVisible()

    // Verify progress bars are present
    await expect(page.locator('.progress-bar')).toHaveCount(2)
  })

  test('should refresh crawler stats', async ({ page }) => {
    // Wait for initial stats to load
    await page.waitForSelector('[data-testid="crawler-stats"]')

    // Click refresh button
    await page.click('button:has-text("Refresh Stats")')

    // Wait for stats to update
    await page.waitForTimeout(2000)

    // Verify stats are still visible
    await expect(page.locator('[data-testid="crawler-stats"]')).toBeVisible()
  })
})

test.describe.skip('API Endpoints', () => {
  test('should return crawler logs via API', async ({ request }) => {
    const response = await request.get('/api/strava/crawler/logs?limit=5')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.logs)).toBe(true)
    expect(data.count).toBeGreaterThanOrEqual(0)
  })

  test('should return crawler stats via API', async ({ request }) => {
    const response = await request.get('/api/strava/crawler/stats')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.stats).toBeDefined()
  })

  test('should trigger crawler via API', async ({ request }) => {
    const response = await request.post('/api/strava/crawl')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.users_processed).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(data.results)).toBe(true)
  })

  test('should return rate limit status via API', async ({ request }) => {
    const response = await request.get('/api/strava/rate-limit')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.limits).toBeDefined()
    expect(data.usage).toBeDefined()
  })
})