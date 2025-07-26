import { createClient } from '@supabase/supabase-js'
import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'
import { config } from '@/lib/config'

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

describe('Crawler Logging Tests', () => {
  let supabase: any
  let crawlerService: StravaCrawlerService

  beforeAll(() => {
    // Initialize Supabase client
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    crawlerService = new StravaCrawlerService()
  })

  describe('User ID Consistency in Logs', () => {
    test('should always include user_id for user-specific operations', async () => {
      // Get recent logs
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Failed to fetch logs:', error)
        return
      }

      const userSpecificLogs = logs.filter((log: any) => {
        // Filter for logs that should have user_id
        const message = log.message?.toLowerCase() || ''
        return (
          message.includes('synced') ||
          message.includes('activities') ||
          message.includes('segments') ||
          message.includes('refresh token') ||
          message.includes('user') ||
          message.includes('authentication')
        )
      })

      // Check that user-specific logs have user_id
      const logsWithoutUserId = userSpecificLogs.filter((log: any) => log.user_id === null)

      expect(logsWithoutUserId).toHaveLength(0)
      
      if (logsWithoutUserId.length > 0) {
        console.error('Logs without user_id:', logsWithoutUserId)
      }
    })

    test('should have consistent user_id in error messages', async () => {
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .eq('status', 'error')
        .order('run_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Failed to fetch error logs:', error)
        return
      }

      const userErrorLogs = logs.filter((log: any) => {
        const message = log.message?.toLowerCase() || ''
        return message.includes('user') && message.includes('refresh token')
      })

      // Check that user error logs have user_id
      const errorLogsWithoutUserId = userErrorLogs.filter((log: any) => log.user_id === null)

      expect(errorLogsWithoutUserId).toHaveLength(0)

      // Check that user_id in log matches user_id mentioned in message
      userErrorLogs.forEach((log: any) => {
        if (log.user_id && log.message) {
          const messageUserId = log.message.match(/user (\d+)/)?.[1]
          if (messageUserId) {
            expect(log.user_id.toString()).toBe(messageUserId)
          }
        }
      })
    })

    test('should have proper user_id for successful operations', async () => {
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .eq('status', 'success')
        .not('user_id', 'is', null)
        .order('run_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Failed to fetch success logs:', error)
        return
      }

      // Check that success logs with user_id have meaningful data
      logs.forEach((log: any) => {
        expect(log.user_id).toBeGreaterThan(0)
        expect(log.message).toBeTruthy()
        expect(log.run_at).toBeTruthy()
      })
    })
  })

  describe('Log Entry Structure', () => {
    test('should have required fields for all log entries', async () => {
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Failed to fetch logs:', error)
        return
      }

      logs.forEach((log: any) => {
        // Required fields
        expect(log.run_at).toBeTruthy()
        expect(log.status).toBeTruthy()
        expect(log.message).toBeTruthy()
        expect(log.execution_time_ms).toBeDefined()

        // Status should be valid
        expect(['success', 'error', 'partial']).toContain(log.status)

        // Execution time should be reasonable
        expect(log.execution_time_ms).toBeGreaterThanOrEqual(0)
      })
    })

    test('should have consistent data types', async () => {
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Failed to fetch logs:', error)
        return
      }

      logs.forEach((log: any) => {
        // user_id should be number or null
        if (log.user_id !== null) {
          expect(typeof log.user_id).toBe('number')
        }

        // activities_fetched and segments_fetched should be numbers
        expect(typeof log.activities_fetched).toBe('number')
        expect(typeof log.segments_fetched).toBe('number')

        // execution_time_ms should be number
        expect(typeof log.execution_time_ms).toBe('number')
      })
    })
  })

  describe('System vs User Logs', () => {
    test('should distinguish between system and user logs', async () => {
      const { data: logs, error } = await supabase
        .from('strava_crawler_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Failed to fetch logs:', error)
        return
      }

      const systemLogs = logs.filter((log: any) => {
        const message = log.message?.toLowerCase() || ''
        return message.includes('cron job') || message.includes('scheduled')
      })

      const userLogs = logs.filter((log: any) => {
        const message = log.message?.toLowerCase() || ''
        return (
          message.includes('synced') ||
          message.includes('activities') ||
          message.includes('segments') ||
          message.includes('refresh token')
        )
      })

      // System logs can have null user_id
      systemLogs.forEach((log: any) => {
        // System logs are acceptable with null user_id
        expect(log.message).toMatch(/cron job|scheduled/i)
      })

      // User logs should have user_id
      userLogs.forEach((log: any) => {
        expect(log.user_id).not.toBeNull()
        expect(log.user_id).toBeGreaterThan(0)
      })
    })
  })
}) 