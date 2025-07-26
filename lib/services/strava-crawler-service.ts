import { createClient } from '@supabase/supabase-js'
import { StravaService } from './strava-service'
import { config } from '@/lib/config'

// Types for the crawler service
export interface CrawlerResult {
  success: boolean
  user_id: number
  user_name: string
  activities_fetched: number
  segments_fetched: number
  errors: string[]
  rate_limit_status?: any
  execution_time_ms: number
  message?: string // Add message property
}

export interface CrawlerOptions {
  user_id?: number // If not provided, will process all users
  batch_size?: number
  include_segments?: boolean
  dry_run?: boolean
  segment_batch_size?: number // Add segment_batch_size property
}

export interface CrawlerLogEntry {
  id?: string
  run_at: string
  user_id?: number
  status: 'success' | 'error' | 'partial'
  message: string
  activities_fetched: number
  segments_fetched: number
  error?: string
  execution_time_ms: number
  rate_limit_status?: any
}

// Shared core crawler service
export class StravaCrawlerService {
  private supabase: ReturnType<typeof createClient>
  private stravaService!: StravaService

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
  }

  /**
   * Main crawler method - can be called from any trigger
   */
  async crawlStravaData(options: CrawlerOptions = {}): Promise<CrawlerResult[]> {
    const startTime = Date.now()
    const results: CrawlerResult[] = []

    try {
      // Get users to process
      const users = await this.getUsersToProcess(options.user_id)
      console.log(`🔄 Starting crawler for ${users.length} user(s)`)

      // Process each user
      for (const user of users) {
        try {
          const result = await this.processUser(user, options)
          results.push(result)
          
          // Log the result
          await this.logCrawlerResult({
            user_id: user.strava_id,
            status: result.success ? 'success' : 'error',
            message: result.success 
              ? `Synced ${result.activities_fetched} activities, ${result.segments_fetched} segments`
              : result.errors.join(', '),
            activities_fetched: result.activities_fetched,
            segments_fetched: result.segments_fetched,
            error: result.success ? undefined : result.errors.join(', '),
            execution_time_ms: result.execution_time_ms,
            rate_limit_status: result.rate_limit_status
          })

        } catch (error: any) {
          console.error(`❌ Error processing user ${user.strava_id}:`, error)
          
          const errorResult: CrawlerResult = {
            success: false,
            user_id: user.strava_id,
            user_name: `${user.firstname} ${user.lastname}`,
            activities_fetched: 0,
            segments_fetched: 0,
            errors: [error?.message || 'Unknown error'],
            execution_time_ms: Date.now() - startTime
          }
          
          results.push(errorResult)
          
          await this.logCrawlerResult({
            user_id: user.strava_id,
            status: 'error',
            message: `Failed to process user: ${error?.message || 'Unknown error'}`,
            activities_fetched: 0,
            segments_fetched: 0,
            error: error?.message || 'Unknown error',
            execution_time_ms: Date.now() - startTime
          })
        }
      }

      console.log(`✅ Crawler completed. Processed ${users.length} users in ${Date.now() - startTime}ms`)
      return results

    } catch (error) {
      console.error('❌ Crawler failed:', error)
      throw error
    }
  }

  /**
   * Get users to process (single user or all users)
   */
  private async getUsersToProcess(userId?: number) {
    let query = this.supabase
      .from('users')
      .select(`
        strava_id,
        firstname,
        lastname,
        strava_tokens!inner(access_token, refresh_token, expires_at)
      `)
      .not('strava_tokens.expires_at', 'lt', new Date().toISOString())

    if (userId) {
      query = query.eq('strava_id', userId)
    }

    const { data: users, error } = await query

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    if (!users || users.length === 0) {
      throw new Error('No users with valid Strava tokens found')
    }

    return users as { strava_id: number; firstname: string; lastname: string }[]
  }

  /**
   * Process a single user's Strava data
   */
  private async processUser(user: any, options: CrawlerOptions = {}): Promise<CrawlerResult> {
    const startTime = Date.now()
    const result: CrawlerResult = {
      success: true, // Initialize as success
      user_id: user.strava_id,
      user_name: `${user.firstname} ${user.lastname}`,
      activities_fetched: 0,
      segments_fetched: 0,
      errors: [],
      execution_time_ms: 0,
      message: 'User processed successfully' // Set default message
    }

    try {
      console.log(`🔄 Processing user: ${user.firstname} ${user.lastname} (${user.strava_id})`)
      
      // Initialize StravaService with user ID
      this.stravaService = new StravaService(user.strava_id)
      
      // Sync activities
      const activityResult = await this.stravaService.syncActivities(options.batch_size || 200)

      // Sync segments if requested
      if (options.include_segments !== false) {
        const segmentResult = await this.stravaService.syncSegments(options.segment_batch_size || 50)
        result.segments_fetched = segmentResult.segmentsAdded
      }

      result.execution_time_ms = Date.now() - startTime
      result.message = `Successfully processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments`
      console.log(`✅ User ${user.firstname} ${user.lastname} processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments`)

    } catch (error: any) {
      result.success = false // Ensure success is false on error
      result.errors.push(error.message)
      result.execution_time_ms = Date.now() - startTime

      // Handle specific error types
      if (error.message.includes('Invalid refresh token')) {
        result.message = `User ${user.firstname} ${user.lastname} needs to re-authenticate with Strava`
        console.log(`⚠️ User ${user.firstname} ${user.lastname} (${user.strava_id}) needs re-authentication`)
      } else if (error.message.includes('Rate limit exceeded')) {
        result.message = `Rate limit hit while processing user ${user.firstname} ${user.lastname}`
        console.log(`⚠️ Rate limit exceeded for user ${user.firstname} ${user.lastname} (${user.strava_id})`)
      } else {
        result.message = `Error processing user ${user.firstname} ${user.lastname}: ${error.message}`
        console.error(`❌ Error processing user ${user.firstname} ${user.lastname} (${user.strava_id}):`, error)
      }
    }

    return result
  }

  /**
   * Log crawler results to database
   */
  private async logCrawlerResult(logEntry: Omit<CrawlerLogEntry, 'run_at'>) {
    try {
      const { error } = await this.supabase
        .from('strava_crawler_logs')
        .insert({
          ...logEntry,
          run_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to log crawler result:', error)
      }
    } catch (error) {
      console.error('Failed to log crawler result:', error)
    }
  }

  /**
   * Get recent crawler logs
   */
  async getRecentLogs(limit: number = 10): Promise<CrawlerLogEntry[]> {
    const { data, error } = await this.supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`)
    }

    return (data as unknown as CrawlerLogEntry[]) || []
  }

  /**
   * Get crawler statistics
   */
  async getCrawlerStats() {
    const { data: logs, error } = await this.supabase
      .from('strava_crawler_logs')
      .select('*')
      .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`)
    }

    const typedLogs = (logs as unknown as CrawlerLogEntry[]) || []
    const totalRuns = typedLogs.length
    const successfulRuns = typedLogs.filter(log => log.status === 'success').length
    const totalActivities = typedLogs.reduce((sum, log) => sum + (log.activities_fetched || 0), 0)
    const totalSegments = typedLogs.reduce((sum, log) => sum + (log.segments_fetched || 0), 0)

    return {
      total_runs_24h: totalRuns,
      successful_runs_24h: successfulRuns,
      success_rate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      total_activities_24h: totalActivities,
      total_segments_24h: totalSegments,
      last_run: typedLogs[0]?.run_at
    }
  }
} 