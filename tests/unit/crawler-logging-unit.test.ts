import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  eq: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis()
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

describe('Crawler Service Logging', () => {
  let crawlerService: StravaCrawlerService

  beforeEach(() => {
    jest.clearAllMocks()
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
      const mockStravaService = {
        syncActivities: jest.fn().mockRejectedValue(new Error('Test error')),
        syncSegments: jest.fn()
      }

      // Mock the constructor to return our mock service
      jest.spyOn(crawlerService as any, 'stravaService', 'get').mockReturnValue(mockStravaService)

      const result = await (crawlerService as any).processUser(mockUser)

      expect(result.user_id).toBe(123456)
      expect(result.success).toBe(false)
      expect(result.errors).toContain('Test error')
    })

    test('should log successful operations with correct user_id', async () => {
      const mockUser = {
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User'
      }

      // Mock successful operations
      const mockStravaService = {
        syncActivities: jest.fn().mockResolvedValue({ synced: 5 }),
        syncSegments: jest.fn().mockResolvedValue({ segmentsAdded: 10 })
      }

      jest.spyOn(crawlerService as any, 'stravaService', 'get').mockReturnValue(mockStravaService)

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

      const mockStravaService = {
        syncActivities: jest.fn().mockRejectedValue(
          new Error('Invalid refresh token - user undefined needs to re-authenticate with Strava')
        ),
        syncSegments: jest.fn()
      }

      jest.spyOn(crawlerService as any, 'stravaService', 'get').mockReturnValue(mockStravaService)

      const result = await (crawlerService as any).processUser(mockUser)

      // The error message should be updated to include the correct user_id
      expect(result.message).toContain('user 123456')
      expect(result.message).not.toContain('user undefined')
    })
  })
}) 