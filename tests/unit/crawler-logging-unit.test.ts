import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'
import { StravaService } from '@/lib/services/strava-service'

// Mock Supabase client (assigned inside mocked module factory).
// Use var to avoid jest.mock hoist/TDZ issues in this test file.
var mockSupabase: any = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  eq: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

describe('Crawler Service Logging', () => {
  let crawlerService: StravaCrawlerService

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    mockSupabase.from.mockReturnThis()
    mockSupabase.insert.mockResolvedValue({ data: null, error: null })
    mockSupabase.select.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockResolvedValue({ data: [], error: null })
    mockSupabase.eq.mockReturnThis()
    mockSupabase.not.mockReturnThis()
    mockSupabase.single.mockResolvedValue({ data: null, error: null })
    crawlerService = new StravaCrawlerService()
  })

  describe('logCrawlerResult', () => {
    test('should always include user_id when provided', async () => {
      const logEntry = {
        user_id: 123456,
        status: 'success' as const,
        message: 'Test message',
        activities_fetched: 10,
        segments_fetched: 5,
        execution_time_ms: 1000
      }

      // Access the private method for testing
      await (crawlerService as any).logCrawlerResult(logEntry)

      expect(mockSupabase.from).toHaveBeenCalledWith('strava_crawler_logs')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 123456,
          status: 'success',
          message: 'Test message',
          activities_fetched: 10,
          segments_fetched: 5,
          execution_time_ms: 1000,
          run_at: expect.any(String)
        })
      )
    })

    test('should handle null user_id for system logs', async () => {
      const logEntry = {
        user_id: null,
        status: 'success' as const,
        message: 'Cron job completed successfully',
        activities_fetched: 0,
        segments_fetched: 0,
        execution_time_ms: 100
      }

      await (crawlerService as any).logCrawlerResult(logEntry)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          status: 'success',
          message: 'Cron job completed successfully'
        })
      )
    })

    test('should include run_at timestamp', async () => {
      const logEntry = {
        user_id: 123456,
        status: 'error' as const,
        message: 'Test error',
        activities_fetched: 0,
        segments_fetched: 0,
        execution_time_ms: 500
      }

      await (crawlerService as any).logCrawlerResult(logEntry)

      const insertCall = mockSupabase.insert.mock.calls[0][0]
      expect(insertCall.run_at).toBeDefined()
      expect(new Date(insertCall.run_at)).toBeInstanceOf(Date)
    })
  })

  describe('processUser logging', () => {
    test('should log user-specific errors with correct user_id', async () => {
      const mockUser = {
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User'
      }

      // Mock the StravaService to throw an error
      jest.spyOn(StravaService.prototype, 'syncAllData').mockRejectedValue(new Error('Test error'))
      jest.spyOn(StravaService.prototype, 'getRateLimitStatus').mockReturnValue({
        mode: 'normal',
        requests15min: 0,
        requestsDay: 0,
        remaining15min: 100,
        remainingDay: 1000,
        limit15min: 100,
        limitDay: 1000,
        nextReset15min: new Date(),
        nextResetDaily: new Date(),
        lastUpdate: new Date(),
      } as any)

      const result = await (crawlerService as any).processUser(mockUser)

      expect(result.user_id).toBe(123456)
      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sync failed: Test error')
    })

    test('should log successful operations with correct user_id', async () => {
      const mockUser = {
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User'
      }

      // Mock successful operations
      jest.spyOn(StravaService.prototype, 'syncAllData').mockResolvedValue({
        activities: { synced: 5, errors: 0 },
        segments: { processed: 5, segmentsAdded: 10, errors: 0 },
        segmentEfforts: { total: 12 },
        totalExecutionTime: 100,
      })
      jest.spyOn(StravaService.prototype, 'getRateLimitStatus').mockReturnValue({
        mode: 'normal',
        requests15min: 0,
        requestsDay: 0,
        remaining15min: 100,
        remainingDay: 1000,
        limit15min: 100,
        limitDay: 1000,
        nextReset15min: new Date(),
        nextResetDaily: new Date(),
        lastUpdate: new Date(),
      } as any)

      const result = await (crawlerService as any).processUser(mockUser)

      expect(result.user_id).toBe(123456)
      expect(result.success).toBe(true)
      expect(result.activities_fetched).toBe(5)
      expect(result.segments_fetched).toBe(10)
    })
  })

  describe('Error message consistency', () => {
    test('should include user_id in error messages', async () => {
      const mockUser = {
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User'
      }

      jest.spyOn(StravaService.prototype, 'syncAllData').mockRejectedValue(
        new Error('Invalid refresh token - user undefined needs to re-authenticate with Strava')
      )
      jest.spyOn(StravaService.prototype, 'getRateLimitStatus').mockReturnValue({
        mode: 'normal',
        requests15min: 0,
        requestsDay: 0,
        remaining15min: 100,
        remainingDay: 1000,
        limit15min: 100,
        limitDay: 1000,
        nextReset15min: new Date(),
        nextResetDaily: new Date(),
        lastUpdate: new Date(),
      } as any)

      const result = await (crawlerService as any).processUser(mockUser)

      // Error message should not regress to "user undefined" and should stay user-specific.
      expect(result.message).toContain('Test User')
      expect(result.message).not.toContain('user undefined')
    })
  })
}) 