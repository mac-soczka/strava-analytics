import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock StravaService
jest.mock('@/lib/services/strava-service', () => ({
  StravaService: jest.fn().mockImplementation(() => ({
    syncActivities: jest.fn(),
    syncSegments: jest.fn(),
    getRateLimitStatus: jest.fn()
  }))
}))

describe('StravaCrawlerService Integration', () => {
  let crawlerService: StravaCrawlerService
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn()
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    
    crawlerService = new StravaCrawlerService()
  })

  describe('crawlStravaData', () => {
    it('should process user activities end-to-end', async () => {
      const mockUsers = [
        {
          strava_id: 12345,
          firstname: 'John',
          lastname: 'Doe'
        }
      ]

      const mockActivities = [
        {
          id: 123456789,
          name: "Morning Ride",
          distance: 25000,
          moving_time: 3600,
          elapsed_time: 3600,
          total_elevation_gain: 150,
          type: "Ride",
          start_date: "2025-07-26T10:00:00Z",
          start_date_local: "2025-07-26T10:00:00Z"
        }
      ]

      // Mock getUsersToProcess
      mockSupabase.limit.mockResolvedValue({
        data: mockUsers,
        error: null
      })

      // Mock logCrawlerResult
      mockSupabase.insert.mockResolvedValue({
        data: { id: 'log-id' },
        error: null
      })

      const result = await crawlerService.crawlStravaData({
        user_id: 12345,
        batch_size: 10,
        include_segments: true
      })

      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe(12345)
      expect(result[0].user_name).toBe('John Doe')
    })

    it('should handle multiple users correctly', async () => {
      const mockUsers = [
        { strava_id: 12345, firstname: 'John', lastname: 'Doe' },
        { strava_id: 67890, firstname: 'Jane', lastname: 'Smith' }
      ]

      mockSupabase.limit.mockResolvedValue({
        data: mockUsers,
        error: null
      })

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'log-id' },
        error: null
      })

      const result = await crawlerService.crawlStravaData()

      expect(result).toHaveLength(2)
      expect(result[0].user_id).toBe(12345)
      expect(result[1].user_id).toBe(67890)
    })

    it('should handle partial failures gracefully', async () => {
      const mockUsers = [
        { strava_id: 12345, firstname: 'John', lastname: 'Doe' },
        { strava_id: 67890, firstname: 'Jane', lastname: 'Smith' }
      ]

      mockSupabase.limit.mockResolvedValue({
        data: mockUsers,
        error: null
      })

      // Mock one user to fail
      const { StravaService } = require('@/lib/services/strava-service')
      const mockStravaService = StravaService.mock.instances[0]
      
      mockStravaService.syncActivities
        .mockResolvedValueOnce({ synced: 5, errors: 0 }) // First user succeeds
        .mockRejectedValueOnce(new Error('API Error')) // Second user fails

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'log-id' },
        error: null
      })

      const result = await crawlerService.crawlStravaData()

      expect(result).toHaveLength(2)
      expect(result[0].success).toBe(true)
      expect(result[1].success).toBe(false)
      expect(result[1].errors).toContain('API Error')
    })

    it('should log results to database', async () => {
      const mockUsers = [
        { strava_id: 12345, firstname: 'John', lastname: 'Doe' }
      ]

      mockSupabase.limit.mockResolvedValue({
        data: mockUsers,
        error: null
      })

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'log-id' },
        error: null
      })

      await crawlerService.crawlStravaData()

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 12345,
          status: expect.any(String),
          message: expect.any(String),
          activities_fetched: expect.any(Number),
          segments_fetched: expect.any(Number)
        })
      )
    })
  })

  describe('getRecentLogs', () => {
    it('should return recent crawler logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          run_at: '2025-07-26T10:00:00Z',
          user_id: 12345,
          status: 'success',
          message: 'Synced 5 activities',
          activities_fetched: 5,
          segments_fetched: 2
        }
      ]

      mockSupabase.limit.mockResolvedValue({
        data: mockLogs,
        error: null
      })

      const result = await crawlerService.getRecentLogs(5)

      expect(result).toEqual(mockLogs)
      expect(mockSupabase.from).toHaveBeenCalledWith('strava_crawler_logs')
      expect(mockSupabase.order).toHaveBeenCalledWith('run_at', { ascending: false })
      expect(mockSupabase.limit).toHaveBeenCalledWith(5)
    })
  })

  describe('getCrawlerStats', () => {
    it('should return crawler statistics', async () => {
      const mockStats = {
        total_runs: 10,
        successful_runs: 8,
        failed_runs: 2,
        total_activities: 150,
        total_segments: 75,
        average_execution_time: 5000
      }

      mockSupabase.single.mockResolvedValue({
        data: mockStats,
        error: null
      })

      const result = await crawlerService.getCrawlerStats()

      expect(result).toEqual(mockStats)
    })
  })
}) 