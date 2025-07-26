import { StravaService } from '@/lib/services/strava-service'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock fetch
global.fetch = jest.fn()

describe('StravaService', () => {
  let stravaService: StravaService
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis()
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    
    stravaService = new StravaService(12345)
  })

  describe('getValidTokens', () => {
    it('should return valid tokens for authenticated user', async () => {
      const mockTokens = {
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        strava_id: 12345
      }

      mockSupabase.single.mockResolvedValue({
        data: mockTokens,
        error: null
      })

      const result = await stravaService.getValidTokens()

      expect(result).toEqual(mockTokens)
      expect(mockSupabase.from).toHaveBeenCalledWith('strava_tokens')
      expect(mockSupabase.eq).toHaveBeenCalledWith('strava_id', 12345)
    })

    it('should throw error when no tokens found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      await expect(stravaService.getValidTokens()).rejects.toThrow(
        'No Strava tokens found. Please authenticate first.'
      )
    })

    it('should refresh expired tokens automatically', async () => {
      const expiredTokens = {
        access_token: 'expired_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        strava_id: 12345
      }

      const newTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }

      mockSupabase.single.mockResolvedValue({
        data: expiredTokens,
        error: null
      })

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        })
      })

      const result = await stravaService.getValidTokens()

      expect(fetch).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      )
    })
  })

  describe('fetchActivities', () => {
    it('should fetch activities from Strava API', async () => {
      const mockTokens = {
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }

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

      // Mock getValidTokens
      jest.spyOn(stravaService, 'getValidTokens').mockResolvedValue(mockTokens)

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockActivities)
      })

      const result = await stravaService.fetchActivities()

      expect(result).toEqual(mockActivities)
      expect(fetch).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/athlete/activities?page=1&per_page=30',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer valid_access_token' }
        })
      )
    })

    it('should handle 429 rate limit errors', async () => {
      const mockTokens = {
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }

      jest.spyOn(stravaService, 'getValidTokens').mockResolvedValue(mockTokens)

      // First call returns 429, second call succeeds
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        })

      // Mock setTimeout to run immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn()
        return {} as any
      })

      await stravaService.fetchActivities()

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })
}) 