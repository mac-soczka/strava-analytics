import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test page before each test
    await page.goto('/test')
  })

  test('should display authentication status correctly', async ({ page }) => {
    // Check that the status section exists
    await expect(page.locator('text=App Session Status')).toBeVisible()
    
    // Initially should show no session
    await expect(page.locator('text=No Session')).toBeVisible()
  })

  test('should run session status test', async ({ page }) => {
    // Click the session status test button
    await page.click('button:has-text("Session Status")')
    
    // Wait for test to complete
    await page.waitForSelector('text=App Session Status')
    
    // Check that test results are displayed
    await expect(page.locator('text=Session status check completed')).toBeVisible()
  })

  test('should run OAuth flow simulation', async ({ page }) => {
    // Click the OAuth flow test button
    await page.click('button:has-text("OAuth Flow")')
    
    // Wait for test to complete
    await page.waitForSelector('text=OAuth flow simulation completed')
    
    // Check that test results are displayed
    await expect(page.locator('text=OAuth flow simulation completed')).toBeVisible()
  })

  test('should run complete auth flow test', async ({ page }) => {
    // Click the complete flow test button
    await page.click('button:has-text("Complete Flow")')
    
    // Wait for test to complete
    await page.waitForSelector('text=Complete authentication flow successful')
    
    // Check that test results are displayed
    await expect(page.locator('text=Complete authentication flow successful')).toBeVisible()
  })

  test('should run all auth tests', async ({ page }) => {
    // Click the auth tests button
    await page.click('button:has-text("Auth Tests")')
    
    // Wait for tests to complete (multiple tests run)
    await page.waitForTimeout(3000)
    
    // Check that multiple test results are displayed
    const testResults = page.locator('[data-testid="test-result"]')
    await expect(testResults).toHaveCount(3) // App Session Status, OAuth Flow, App Logout
  })

  test('should run diagnostics tests', async ({ page }) => {
    // Click the diagnostics button
    await page.click('button:has-text("Diagnostics")')
    
    // Wait for tests to complete
    await page.waitForTimeout(5000)
    
    // Check that diagnostic tests completed
    await expect(page.locator('text=Schema check completed')).toBeVisible()
    await expect(page.locator('text=RLS policy test completed')).toBeVisible()
  })

  test('should handle test errors gracefully', async ({ page }) => {
    // Mock a failed API call by going offline
    await page.context().setOffline(true)
    
    // Try to run a test that requires network
    await page.click('button:has-text("Session Status")')
    
    // Wait for error to be displayed
    await page.waitForSelector('text=error')
    
    // Check that error is shown
    await expect(page.locator('text=Session status check failed')).toBeVisible()
    
    // Go back online
    await page.context().setOffline(false)
  })

  test('should clear test results', async ({ page }) => {
    // Run a test first
    await page.click('button:has-text("Session Status")')
    await page.waitForSelector('text=App Session Status')
    
    // Click clear results
    await page.click('button:has-text("Clear Results")')
    
    // Check that results are cleared
    await expect(page.locator('text=No tests run yet')).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route without session', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('/dashboard')
    
    // Should be redirected to home page (login)
    await expect(page).toHaveURL('/')
  })

  test('should show login button when not authenticated', async ({ page }) => {
    await page.goto('/')
    
    // Check that login button is visible
    await expect(page.locator('text=Login with Strava')).toBeVisible()
  })
})

test.describe('API Endpoints', () => {
  test('should return 401 for session endpoint without token', async ({ request }) => {
    const response = await request.get('/api/auth/session')
    
    expect(response.status()).toBe(401)
    
    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })

  test('should handle logout endpoint', async ({ request }) => {
    const response = await request.post('/api/auth/logout')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.message).toBe('Logged out successfully')
  })
}) 