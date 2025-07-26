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
}

export interface CrawlerOptions {
  user_id?: number // If not provided, will process all users
  batch_size?: number
  include_segments?: boolean
  dry_run?: boolean
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
  private async processUser(user: { strava_id: number; firstname: string; lastname: string }, options: CrawlerOptions): Promise<CrawlerResult> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      console.log(`🔄 Processing user: ${user.firstname} ${user.lastname} (${user.strava_id})`)

      // Create StravaService for this user
      this.stravaService = new StravaService()
      
      // Fetch activities
      const activitiesResult = await this.stravaService.syncActivities(options.batch_size || 80)
      
      let segmentsResult = { processed: 0, segmentsAdded: 0, errors: 0 }
      
      // Fetch segments if requested
      if (options.include_segments !== false) {
        try {
          segmentsResult = await this.stravaService.syncSegments(10)
        } catch (segmentError: any) {
          errors.push(`Segment sync failed: ${segmentError?.message || 'Unknown error'}`)
        }
      }

      // Get rate limit status
      const rateLimitStatus = this.stravaService.getRateLimitStatus()

      const result: CrawlerResult = {
        success: errors.length === 0,
        user_id: user.strava_id,
        user_name: `${user.firstname} ${user.lastname}`,
        activities_fetched: activitiesResult.synced,
        segments_fetched: segmentsResult.segmentsAdded,
        errors,
        rate_limit_status: rateLimitStatus,
        execution_time_ms: Date.now() - startTime
      }

      console.log(`✅ User ${user.firstname} processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments`)
      return result

    } catch (error) {
      console.error(`❌ Error processing user ${user.strava_id}:`, error)
      throw error
    }
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