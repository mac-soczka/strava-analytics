import { createClient } from '@supabase/supabase-js'
import { StravaService } from './strava-service'
import { config } from '@/lib/config'
import { TokenHealthService } from './token-health-service'

export interface CrawlerLogEntry {
  run_at: string
  user_id?: number | null
  status: 'success' | 'error' | 'partial'
  message: string
  activities_fetched: number
  segments_fetched: number
  execution_time_ms: number
}

export interface CrawlerResult {
  user_id: number
  user_name: string
  success: boolean
  activities_fetched: number
  segments_fetched: number
  message: string
  errors?: string[]
  execution_time_ms: number
}

export interface CrawlerOptions {
  batch_size?: number
  include_segments?: boolean
  skip_invalid_tokens?: boolean
  segment_batch_size?: number
}

export class StravaCrawlerService {
  private supabase: ReturnType<typeof createClient>
  private stravaService!: StravaService
  private tokenHealthService: TokenHealthService

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    this.tokenHealthService = new TokenHealthService()
  }

  /**
   * Main crawler method
   */
  async crawlStravaData(options: CrawlerOptions = {}): Promise<{
    success: boolean
    users_processed: number
    users_successful: number
    total_activities: number
    total_segments: number
    results: CrawlerResult[]
  }> {
    const startTime = Date.now()
    console.log('🚀 Starting Strava data crawler...')

    try {
      // Check token health if requested
      if (options.skip_invalid_tokens) {
        console.log('🔍 Checking token health before crawling...')
        const tokenHealth = await this.tokenHealthService.checkAllTokenHealth()
        const usersWithValidTokens = tokenHealth.filter(status => !status.needs_reauthentication)
        console.log(`✅ Found ${usersWithValidTokens.length} users with valid tokens out of ${tokenHealth.length} total users`)
      }

      const users = await this.getUsersToProcess(options.skip_invalid_tokens)
      console.log(`👥 Processing ${users.length} users...`)

      const results: CrawlerResult[] = []
      let totalActivities = 0
      let totalSegments = 0
      let successfulUsers = 0

      for (const user of users) {
        const result = await this.processUser(user, options)
        results.push(result)

        if (result.success) {
          successfulUsers++
          totalActivities += result.activities_fetched
          totalSegments += result.segments_fetched
        }
      }

      const executionTime = Date.now() - startTime
      const summary = {
        success: true,
        users_processed: users.length,
        users_successful: successfulUsers,
        total_activities: totalActivities,
        total_segments: totalSegments,
        results
      }

      // Log the overall result
      await this.logCrawlerResult({
        user_id: null, // System log
        status: 'success',
        message: `Crawler completed: ${successfulUsers}/${users.length} users successful, ${totalActivities} activities, ${totalSegments} segments`,
        activities_fetched: totalActivities,
        segments_fetched: totalSegments,
        execution_time_ms: executionTime
      })

      console.log('✅ Crawler completed successfully')
      return summary

    } catch (error: any) {
      const executionTime = Date.now() - startTime
      console.error('❌ Crawler failed:', error)

      await this.logCrawlerResult({
        user_id: null, // System log
        status: 'error',
        message: `Crawler failed: ${error.message}`,
        activities_fetched: 0,
        segments_fetched: 0,
        execution_time_ms: executionTime
      })

      return {
        success: false,
        users_processed: 0,
        users_successful: 0,
        total_activities: 0,
        total_segments: 0,
        results: []
      }
    }
  }

  /**
   * Get users to process, optionally filtering by token health
   */
  private async getUsersToProcess(skipInvalidTokens = false): Promise<any[]> {
    if (skipInvalidTokens) {
      // Get only users with valid tokens
      const tokenHealth = await this.tokenHealthService.checkAllTokenHealth()
      const validUserIds = tokenHealth
        .filter(status => !status.needs_reauthentication)
        .map(status => status.strava_id)

      if (validUserIds.length === 0) {
        console.log('⚠️  No users with valid tokens found')
        return []
      }

      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')
        .in('strava_id', validUserIds)

      if (error) {
        console.error('Failed to fetch users with valid tokens:', error)
        return []
      }

      return users || []
    } else {
      // Get all users
      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')

      if (error) {
        console.error('Failed to fetch users:', error)
        return []
      }

      return users || []
    }
  }

  /**
   * Process a single user's Strava data
   */
  private async processUser(user: any, options: CrawlerOptions = {}): Promise<CrawlerResult> {
    const startTime = Date.now()
    const result: CrawlerResult = {
      user_id: user.strava_id,
      user_name: `${user.firstname} ${user.lastname}`,
      success: false,
      activities_fetched: 0,
      segments_fetched: 0,
      message: '',
      errors: [],
      execution_time_ms: 0
    }

    try {
      console.log(`🔄 Processing user: ${user.firstname} ${user.lastname} (${user.strava_id})`)
      
      // Initialize StravaService for this user
      this.stravaService = new StravaService(user.strava_id)
      
      // Log initial rate limit status
      const initialRateLimitStatus = this.stravaService.getRateLimitStatus()
      console.log(`📊 Initial rate limit status for ${user.firstname}: ${initialRateLimitStatus.mode} - 15min: ${initialRateLimitStatus.requests15min}/${initialRateLimitStatus.requestsPer15Min}, Day: ${initialRateLimitStatus.requestsDay}/${initialRateLimitStatus.requestsPerDay}`)

      // Sync activities
      const activityResult = await this.stravaService.syncActivities(options.batch_size || config.stravaApiLimits.maxCrawlerBatchSize)
      result.activities_fetched = activityResult.synced

      // Log rate limit status after activities
      const afterActivitiesRateLimitStatus = this.stravaService.getRateLimitStatus()
      console.log(`📊 Rate limit status after activities for ${user.firstname}: 15min: ${afterActivitiesRateLimitStatus.requests15min}/${afterActivitiesRateLimitStatus.requestsPer15Min}, Day: ${afterActivitiesRateLimitStatus.requestsDay}/${afterActivitiesRateLimitStatus.requestsPerDay}`)

      // Sync segments if requested
      if (options.include_segments !== false) {
        const segmentResult = await this.stravaService.syncSegments(options.segment_batch_size || config.stravaApiLimits.maxSegmentBatchSize)
        result.segments_fetched = segmentResult.segmentsAdded
      }

      // Log final rate limit status
      const finalRateLimitStatus = this.stravaService.getRateLimitStatus()
      console.log(`📊 Final rate limit status for ${user.firstname}: 15min: ${finalRateLimitStatus.requests15min}/${finalRateLimitStatus.requestsPer15Min}, Day: ${finalRateLimitStatus.requestsDay}/${finalRateLimitStatus.requestsPerDay}`)

      result.execution_time_ms = Date.now() - startTime
      result.success = true
      result.message = `Successfully processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments`
      console.log(`✅ User ${user.firstname} ${user.lastname} processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments`)

    } catch (error: any) {
      result.success = false // Ensure success is false on error
      if (!result.errors) result.errors = []
      result.errors.push(error.message)
      result.execution_time_ms = Date.now() - startTime

      // Handle specific error types with enhanced logging
      if (error.message.includes('Invalid refresh token')) {
        result.message = `User ${user.firstname} ${user.lastname} needs to re-authenticate with Strava`
        console.log(`⚠️ User ${user.firstname} ${user.lastname} (${user.strava_id}) needs re-authentication`)
      } else if (error.message.includes('Rate limit exceeded')) {
        result.message = `Rate limit hit while processing user ${user.firstname} ${user.lastname}`
        console.log(`⚠️ Rate limit exceeded for user ${user.firstname} ${user.lastname} (${user.strava_id})`)
        
        // Log detailed rate limit information
        if (this.stravaService) {
          const rateLimitStatus = this.stravaService.getRateLimitStatus()
          console.log(`📊 Rate limit details at failure: ${rateLimitStatus.mode} - 15min: ${rateLimitStatus.requests15min}/${rateLimitStatus.requestsPer15Min}, Day: ${rateLimitStatus.requestsDay}/${rateLimitStatus.requestsPerDay}`)
        }
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

  /**
   * Get comprehensive entity statistics
   */
  async getEntityStats() {
    try {
      // Get total counts from database
      const [activitiesCount, segmentsCount, segmentEffortsCount, usersCount] = await Promise.all([
        this.supabase.from('activities').select('*', { count: 'exact', head: true }),
        this.supabase.from('segments').select('*', { count: 'exact', head: true }),
        this.supabase.from('segment_efforts').select('*', { count: 'exact', head: true }),
        this.supabase.from('users').select('*', { count: 'exact', head: true })
      ])

      // Get recent crawler activity (last 7 days)
      const { data: recentLogs } = await this.supabase
        .from('strava_crawler_logs')
        .select('*')
        .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('run_at', { ascending: false })

      const typedLogs = (recentLogs as unknown as CrawlerLogEntry[]) || []
      const recentActivities = typedLogs.reduce((sum, log) => sum + (log.activities_fetched || 0), 0)
      const recentSegments = typedLogs.reduce((sum, log) => sum + (log.segments_fetched || 0), 0)

      return {
        totals: {
          activities: activitiesCount.count || 0,
          segments: segmentsCount.count || 0,
          segment_efforts: segmentEffortsCount.count || 0,
          users: usersCount.count || 0
        },
        recent_activity: {
          activities_fetched_7d: recentActivities,
          segments_fetched_7d: recentSegments,
          last_crawler_run: typedLogs[0]?.run_at
        },
        summary: {
          total_entities: (activitiesCount.count || 0) + (segmentsCount.count || 0) + (segmentEffortsCount.count || 0),
          active_users: usersCount.count || 0,
          data_freshness: typedLogs[0]?.run_at ? new Date(typedLogs[0].run_at).toISOString() : null
        }
      }
    } catch (error) {
      console.error('Failed to get entity stats:', error)
      return {
        totals: { activities: 0, segments: 0, segment_efforts: 0, users: 0 },
        recent_activity: { activities_fetched_7d: 0, segments_fetched_7d: 0, last_crawler_run: null },
        summary: { total_entities: 0, active_users: 0, data_freshness: null }
      }
    }
  }
} 